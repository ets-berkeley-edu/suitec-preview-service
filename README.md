# Preview service

This service exposes a very simple REST api with 1 endpoint allowing [Collabosphere](https://github.com/ets-berkeley-edu/collabosphere) to generate preview images for files and links.

## Dependencies

### GhostScript

Download and install [Ghostscript](http://ghostscript.com/download/). This dependency takes care of converting PDF pages into images.

### LibreOffice

Download and install [LibreOffice](http://www.libreoffice.org/download/). This dependency takes care of converting Microsoft Office files to PDFs.

## Running the application

```
node app
```

## How it works

### Overview

Preview requests are submitted to the REST API which then queues a job on an Amazon SQS queue.
Jobs are picked up off the queue sequentially (ie: only job gets processed at a time) and get processed.
The results get stored in Amazon S3 and then finally the result get posted back to the caller.

### Detailed:

The REST API exposes 1 endpoint (`/process`) which takes in three parameters:
 - `id`: The asset id
 - `url`: The URL where the file can be downloaded from (or simply the link to the webpage)
 - `postBackUrl`: A URL where the results can be sent to through an HTTP POST request

This gets fed onto SQS so it can be processed asynchronously and the system can't get overloaded.

When a job gets processed, a temporary directory gets created where files can be stored during processing.
Once processing is over, that directory will be removed. All processing happens in a child process.
This makes it easier to handle timeouts and resource cleanup.

Once processing is finished, the results are stored in Amazon S3 and the caller is notified about all the URLS and metadata through an HTTP post request.

## Development

As this application makes use of Amazon SQS and S3 it can be beneficial to run these locally rather than use the actual services.

The development configuration at `config/development.json` already assumes you're running these services locally.


### Runing a local SQS queue

You can mimick an SQS queue by running [elasticmq](https://github.com/adamw/elasticmq) locally.

Run it using the `elasticmq.conf` file in the `etc/sqs` directory:
```
java -Dconfig.file=etc/sqs/elasticmq.conf -jar elasticmq-server-0.9.3.jar
```

### Running an S3 bucket

Install the `fakes3` gem:
```
gem install fakes3
```

Create a directory where files can be stored
```
mkdir s3-data
```

Run the S3 server:
```
fakes3 -r ~/projects/fronteer/berkeley/fakes3 -p 4567
```

If your bucket is called `ets-collabosphere` you will have to add an entry to your `/etc/hosts` like so:
```
127.0.0.1    ets-collabosphere.localhost
```
