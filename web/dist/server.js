import { Server, override } from '@corethrill/web/server';
import dotenv from 'dotenv';
import $ from '@corethrill/core';

var Index = {
  oninit: node => {
    node.ctx.page.title = 'Welcome';
  },
  view: node => $("section", null, $("h1", null, "An open standard for asset metadata on the XRP Ledger."), $("p", null, "This site is under construction."))
};

dotenv.config();

var blueprint = {
	platform: 'web',
	routes: {
		'/': Index
	},
	assets: {
		styles: {
			dir: 'assets/css',
			global: ['global.css'],
		}
	},
	server: {
		port: process.env.PORT
	}
};

// server entry
new Server(override(blueprint, {"assets":{"client":"client.js"}}));
