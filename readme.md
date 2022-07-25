# The XRPL Meta Server

This is a Javascript implementation of the [XRPL Meta](https://xrplmeta.org) Server.

XRPL Meta provides the data that is not obtainable by the standard rippled API.  It makes the data available through a JSON REST and WebSocket API, just like rippled. It connects to any number of rippled nodes and tracks updates in real time. Historical data is being backfilled.



## Technical Overview

On the first launch, the server will create its SQLite database files in the config specified data directory. It will then create a full snapshot of the most recent ledger. From there on, it will sync itself with the live transaction stream, and backfill ledger history simultaneously.



## API Documentation

https://xrplmeta.org/docs

The node will listen for incoming HTTP connections on the port specified in the config file. These can either serve a REST query, or be upgraded to a WebSocket connection.



## Requirements

 - Node.js version +14
 - An internet connection
 - More than 3 GB of disk storage



## Install for production use

 Install the public NPM package:

    npm install -g xrplmeta

This will add the `xrplmeta` command to your PATH. Simply run this command to start the server. A template configuration file will be placed in your user directory. It is recommended to adjust this config.



## Install for development

Clone this repository and install the dependencies:

    npm install

The development node can be started using:

    node src/run
