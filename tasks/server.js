/*
 * Grunt Task File
 * ---------------
 *
 * Task: Server
 * Description: Serve the web application.
 * Dependencies: express
 *
 */

module.exports = function(grunt) {

  var _ = grunt.utils._;
  // Shorthand Grunt functions
  var log = grunt.log;

  grunt.registerTask("server", "Run development server.", function(prop) {
    var options, done;
    var props = ["server"];
    var args = this.args;

    // Only keep alive if watch is not set.
    done = args[args.length-1] === "watch" ? function() {} : this.async();

    // If a prop was passed as the argument, use that sub-property of server.
    if (prop) { props.push(prop); }

    // Defaults set for server values
    options = _.defaults(grunt.config(props) || {}, {
      favicon: "./favicon.ico",
      index: "./index.html",

      port: process.env.PORT || 8000,
      host: process.env.HOST || "127.0.0.1"
    });

    options.folders = options.folders || {};

    // Ensure folders have correct defaults
    options.folders = _.defaults(options.folders, {
      app: "./app",
      assets: "./assets",
      dist: "./dist"
    });

    options.files = options.files || {};

    // Ensure files have correct defaults
    options.files = _.defaults(options.files, {
      "app/config.js": "app/config.js"
    });

    // Run the server
    grunt.helper("server", options);

    // Fail task if errors were logged
    if (grunt.errors) { return false; }

    log.writeln("Listening on http://" + options.host + ":" + options.port);
  });

  grunt.registerHelper("server", function(options) {
    // Require libraries.
    var fs = require("fs");
    var path = require("path");
    var express = require("express");

    // If the server is already available use it.
    var site = options.server ? options.server() : express.createServer();

    // Allow users to override the root.
    var root = _.isString(options.root) ? options.root : "/";

    // Process stylus stylesheets.
    site.get(/.styl$/, function(req, res) {
      var url = req.url.split("assets/css/")[1];
      var file = path.join("assets/css", url);

      fs.readFile(file, function(err, contents) {
        grunt.helper("stylus", contents.toString(), {
          paths: ["assets/css/", require("nib").path]
        }, function(css) {
          res.header("Content-type", "text/css");
          res.send(css);
        });
      });
    });

    // Process LESS stylesheets.
    site.get(/.less$/, function(req, res) {
      var url = req.url.split("assets/css/")[1];
      var file = path.join("assets/css", url);

      fs.readFile(file, function(err, contents) {
        grunt.helper("less", contents.toString(), {
          paths: ["assets/css/"]
        }, function(css) {
          res.header("Content-type", "text/css");
          res.send(css);
        });
      });
    });

    // Map static folders.
    Object.keys(options.folders).sort().reverse().forEach(function(key) {
      site.get(root + key + "/*", function(req, res, next) {
        // Find filename.
        var filename = req.url.slice((root + key).length)
        // If there are query parameters, remove them.
        filename = filename.split("?")[0];

        res.sendfile(path.join(options.folders[key] + filename));
      });
    });

    // Map static files.
    if (_.isObject(options.files)) {
      Object.keys(options.files).sort().reverse().forEach(function(key) {
        site.get(root + key, function(req, res) {
          return res.sendfile(options.files[key]);
        });
      });
    }

    // Serve favicon.ico.
    site.use(express.favicon(options.favicon));

    /**
     * Allows the server to proxy a URL to bypass Same Origin Policies for
     * easier API testing.
     *
     * proxies everything under /api out to http://host_running_api.local/api
     * server: {
     *  proxies: {
     *    'api': {
     *      host: 'host_running_api.local',
     *      port: 80, // optional
     *      https: false // optional
     *    }
     *  }
     * }
     */
    if (_.isObject(options.proxies)) {
      httpProxy = require('http-proxy');
      Object.keys(options.proxies).sort().reverse().forEach(function(key) {

        proxy = new httpProxy.HttpProxy({
          changeOrigin: true,
          target: options.proxies[key]
        })

        site.all(root + key + '/*', function(req, res) {
          proxy.proxyRequest(req, res)
        })
      });
    }
    
    // Ensure all routes go home, client side app..
    site.all("*", function(req, res) {
      fs.createReadStream(options.index).pipe(res);
    });

    // Actually listen
    site.listen(options.port, options.host);
  });

};
