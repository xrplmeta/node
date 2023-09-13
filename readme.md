
# The XRPL Meta Node

This is a Javascript implementation of the [XRPL Meta](https://xrplmeta.org) project.

XRPL Meta collects metadata about digital assets on the XRP Ledger. It makes the data available via a JSON REST and WebSocket API, just like [rippled](https://github.com/XRPLF/rippled). It connects to one or multiple rippled or [clio](https://github.com/XRPLF/clio) nodes and tracks updates in real time. Historical data is being backfilled.



## Technical Overview

On the first launch
- The server will create its SQLite database files in the config specified data directory
- It will then create a full snapshot of the most recent ledger

From there on
- It will sync itself with the live transaction stream
- Backfill ledger history simultaneously
- Scrape additional metadata sources, such as [Bithomp](https://bithomp.com), [XRP Scan](https://xrpscan.com) and [Xumm](https://xumm.dev)



## The Config File

When starting the node for the first time, it will automatically create a directory called `.xrplmeta` in the user's home directory. A copy of the [default configuration file](https://github.com/xrplmeta/node/blob/develop/config.template.toml) will be put there, and used.

Alternatively, you can specify which config file to use using

    node src/run --config /path/to/config.toml

The config file uses "stanzas" for configuring each relevant component, such as the [public server API](https://github.com/xrplmeta/node/tree/develop/src/srv) and the [crawlers](https://github.com/xrplmeta/node/tree/develop/src/crawl/crawlers). Delete or comment the respective stanza to disable the component.

Review the comments in [default configuration file](https://github.com/xrplmeta/node/blob/develop/config.template.toml) for further explanation of the individual parameters.



## API Documentation

https://xrplmeta.org/docs

The node will listen for incoming HTTP connections on the port specified in the config file. These can either serve a REST query, or be upgraded to a WebSocket connection.



## Install for production use

Install the public NPM package:

    npm install -g xrplmeta

This will add the `xrplmeta` command to your PATH. Simply run this command to start the server. A template configuration file will be placed in your user directory. It is recommended to adjust this config.



## Install for development

Clone this repository and install the dependencies:

    npm install

The development node can be started using:

    node src/run



## Requirements

- Node.js version +14

- An internet connection

- More than 3 GB of disk storage