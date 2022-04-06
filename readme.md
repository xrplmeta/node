# The XRPL Meta Node

This is a node.js based implementation of the [XRPL Meta Project](https://xrplmeta.org).

> Fetch realtime market- and metadata for any digital asset on the XRP Ledger.

![enter image description here](https://static.xrplmeta.org/node-flowchart.svg?v3)

 - [x] Automatic scraping of the XRPL
 - [x] Automatic scraping of Twitter, Bithomp, XUMM, etc
 - [x] Token indexing ledger-wide
 - [x] Token names, icons, descriptions
 - [x] Token price feed
 - [x] Token trading volume feed
 - [x] Token supply, trustlines, marketcap feed
 - [ ] Token airdrops
 - [ ] NFT indexing ledger-wide
 - [ ] NFT metadata
 - [ ] NFT content delivery
 - [ ] NFT price history 



## Requirements

 - Node.js version +14
 - An internet connection
 - More than 1 GB of disk storage recommended



## Install for production use

 install the public NPM package, like so

    npm install -g xrplmeta

This will add the `xrplmeta` command to your PATH. Simply run this command to start a node. A template configuration file will be placed in your user directory. It is highly advised to adjust this config.



## Install for development

clone this repository and install the dependencies, by running the following command in the repositories root directory

    npm install

The development node can be started using

    node cli

