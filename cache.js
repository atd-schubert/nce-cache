"use strict";

/*
  if-none-match <- etag xx 
  if-modified-since <- last-modified xx
  accept-language -> content-language ...
  ... -> content-length ...
  ... -> expires // Handle delete if older and call next ...
  -> cache-control ...
  ... -> content-md5
  
  
  content-stream, headers, access
*/

var fs = require("fs");
var mkdirp = require("mkdirp");
var crypto = require("crypto");
// var md5 = require("MD5"); for content-md5
var rmdir = require("rmdir");

var sha1 = function(str){
  var s = crypto.createHash("sha1");
  s.update(str);
  return s.digest("hex");
};

var getBestMatching = function(qstr, list, fallback){
  // ex.: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
  var entries = qstr.split(/[ ]*\,[ ]*/);
  var i;
  for(i=0; i<entries.length; i++) {
    entries[i] = entries[i].split(/[ ]*\;[ ]*q=/);
    
    entries[i][0] = entries[i][0].trim();
    if(entries[i][1]) entries[i][1] = parseFloat(entries[i][1]);
    else entries[i][1] = 1;    
  }
  entries.sort(function(a, b){return b[1]-a[1]});

  for(i=0; i<entries.length; i++) if(list.indexOf(entries[i][0])>=0) return entries[i][0];

  return fallback;
};

module.exports = function Cache(nce){
  if(!nce) throw new Error("You have to specify the nce object");
  
//# Mandantory Setup:
  var ext = nce.createExtension({package: require("./package.json")});
  
  ext.on("install", function(event){ // set options, but don't run or make available in nce
    //# Seting extension-config:
    ext.config.dumpPath = ext.config.dumpPath || process.cwd() + "/cache-data";
    ext.config.fallbackContentType = ext.config.fallbackContentType || "text/html";
    
    if(nce.getExtension("i18n")) {
      ext.config.fallbackLanguage = ext.config.fallbackLanguage || nce.getExtension("i18n").config.fallbackLanguage;
    } else {
      ext.config.fallbackLanguage = ext.config.fallbackLanguage || "en";
    }
    ext.config.fallbackCharset = ext.config.fallbackCharset || "utf-8";
    ext.config.allowUsers = ext.config.allowUsers || false;
    
    ext.config.disableAutoETag = ext.config.disableAutoETag || false;
    ext.config.disableAutoLastModified = ext.config.disableAutoLastModified || false;
    ext.config.disableAutoContentLength = ext.config.disableAutoContentLength || false;
    ext.config.disableAutoCacheControl = ext.config.disableAutoCacheControl || false;
    ext.config.fallbackCacheControlValue = ext.config.fallbackCacheControlValue || "max-age=3600"; // 1h
    ext.config.sloppyErrorHandling = ext.config.sloppyErrorHandling || false;

    //* nce-winston
    ext.config.logger = ext.config.logger || {};

    //# Declarations and settings:
    //* nce-winston
    ext.logger = nce.getExtension("winston").createLogger(ext.name, ext.config.logger);
  });
  
  ext.on("uninstall", function(event){ // undo installation
    //# Undeclare:
    //* nce-winston
    nce.getExtension("winston").removeLogger(ext.name);
    delete ext.logger;
  });
  
  ext.on("activate", function(event){ // don't set options, just run, make available in nce or register.
	  if(nce.requestMiddlewares.indexOf(router) === -1) {
		  nce.requestMiddlewares.push(router);
	  }
  });
  
  ext.on("deactivate", function(event){ // undo activation
	  if(nce.requestMiddlewares.indexOf(router) !== -1) {
		  nce.requestMiddlewares.splice(nce.requestMiddlewares.indexOf(router), 1);
	  }
  });
  
//# Private declarations:
  var router = function cacheRouter(req, res, next){
    if(req.method === "POST") return next();
    ext.logger.debug("Try to find with router", {url:req.url, user:req.user});
    return ext.getStream(req.url, req.headers, function(err, stream, headers){
      if(err && err.message.indexOf("ENOENT")>=0) return next();
      if(err) {
        if(ext.config.sloppyErrorHandling) {
          ext.logger.warn("Catch error in sloppy-mode", err);
          return next();
        }
        return next(err);
      }

      if(headers.etag === req.headers["if-none-match"]) {
        res.writeHead(304, headers);
        ext.logger.info("content hasn't changed for '"+req.url+"'.");
        return res.end();
      }
      if(headers["last-modified"] <= req.headers["if-modified-since"]) { // TODO: Proove
        res.writeHead(304, headers);
        ext.logger.info("content hasn't changed for '"+req.url+"'.");
        return res.end();
      }
      res.writeHead(200, headers);
      stream.pipe(res);
      ext.logger.info("streaming cached data for '"+req.url+"'.");
    }, req.user);
  };


//# Public declarations and exports:
  ext.getStream = function(url, headers, cb, user){
    var hashedUrl = sha1(url);
    headers = headers || {};
    headers["accept-language"] = headers["accept-language"] || ext.config.fallbackLanguage;
    headers["accept"] = headers["accept"] || ext.config.fallbackContentType;
    headers["accept-encoding"] = headers["accept-encoding"] || ext.config.fallbackCharset;

    var dirPath = ext.config.dumpPath + "/" + hashedUrl;
    return fs.readFile(dirPath + "/cache.json", function(err, json){
      if(err) return cb(err);
      try {
        var obj = JSON.parse(json.toString());
        var langMatch = getBestMatching(headers["accept-language"], obj.supported.languages, obj.fallback.language);
        var contentTypeMatch = getBestMatching(headers["accept"], obj.supported.contentTypes, obj.fallback.contentType);
        var encodingMatch = getBestMatching(headers["accept-encoding"], obj.supported.charsets, obj.fallback.charset);
        
        var goOn = function(){
          try{
            if(langMatch && contentTypeMatch && encodingMatch) {
              contentTypeMatch = contentTypeMatch.split("/").join("_");
              var stream = fs.createReadStream(dirPath + "/" + [langMatch, contentTypeMatch, encodingMatch].join("."));
              return fs.readFile(dirPath + "/" + [langMatch, contentTypeMatch, encodingMatch, "headers"].join("."), function(err, buffer){
                if(err) return cb(err);
                var json = JSON.parse(buffer.toString());
                if(json.expires < new Date()) {
                  return ext.uncache(url, function(err){
                    if(err) return cb(err);
                    return cb(new Error("ENOENT"));
                  });
                }
                cb(null, stream, json);
              });
            }
          } catch(e){
            return cb(e);
          }
        };
        var unauthed = function(){
          return cb(new Error("ENOENT"));
        };
        
        if(obj.allowUser && !user) {
          return unauthed();
        } else if(obj.allowUser) {
          return nce.getExtension("user").proofUser(user, obj.allowUser, goOn, unauthed);
        } else {
          return goOn()
        }
      } catch(e) {
        return cb(e);
      }
      return cb(new Error("ENOENT"));
    });
  };
  
  ext.cacheStream = function(url, headers, cb, opts){
    var hashedUrl = sha1(url);
    
    opts.supported = opts.supported || {};
    opts.supported.languages = opts.supported.languages || [ext.config.fallbackLanguage];
    opts.supported.contentTypes = opts.supported.contentTypes || [ext.config.fallbackContentType];
    opts.supported.charsets = opts.supported.charsets || [ext.config.fallbackCharset];
    
    opts.fallback = opts.fallback || {};
    opts.fallback.language = opts.fallback.language || ext.config.fallbackLanguage;
    opts.fallback.contentType = opts.fallback.contentType || ext.config.fallbackContentType;
    opts.fallback.charset = opts.fallback.charset || ext.config.fallbackCharset;
    
    if(!("allowUsers" in opts)) opts.allowUsers = ext.config.allowUsers;
    
    if(!("disableAutoETag" in opts)) opts.disableAutoETag = ext.config.disableAutoETag;
    if(!("disableAutoLastModified" in opts)) opts.disableAutoLastModified = ext.config.disableAutoLastModified;
    if(!("disableAutoContentLength" in opts)) opts.disableAutoContentLength = ext.config.disableAutoContentLength;
    if(!("disableAutoCacheControl" in opts)) opts.disableAutoCacheControl = ext.config.disableAutoCacheControl;
    
    opts.fallbackContentType = opts.fallbackContentType || ext.config.fallbackContentType;
    opts.fallbackCharset = opts.fallbackCharset || ext.config.fallbackCharset;
    opts.fallbackLanguage = opts.fallbackLanguage || ext.config.fallbackLanguage;
    opts.fallbackCacheControlValue = opts.fallbackCacheControlValue || ext.config.fallbackCacheControlValue;
    
    headers = headers || {};
    headers["content-language"] = headers["content-language"] || opts.fallbackLanguage;
    headers["content-type"] = headers["content-type"] || opts.fallbackContentType;
    if(headers["content-type"].indexOf(";")<0) headers["content-type"] += "; " + opts.fallbackCharset

    var dirPath = ext.config.dumpPath + "/" + hashedUrl;
    
    mkdirp(dirPath, function(err){
      if(err) return cb(err);
      fs.writeFile(dirPath + "/cache.json", JSON.stringify(opts), function(err){
        if(err) return cb(err);
        try{
          var langMatch = headers["content-language"];
          var contentTypeMatch = headers["content-type"].split(";")[0].trim().split("/").join("_");
          var encodingMatch = headers["content-type"].split(";")[1].trim();
          
          ext.logger.info("Try to cache", {url: url, language:langMatch, contentType: contentTypeMatch, encoding: encodingMatch});
          
          var stream = fs.createWriteStream(dirPath + "/" + [langMatch, contentTypeMatch, encodingMatch].join("."));
          stream.on("close", function(){
            ext.logger.debug("Caching of resource '" + url + "' finished.");
            fs.stat(dirPath + "/" + [langMatch, contentTypeMatch, encodingMatch].join("."), function(err, stats){
              if(err) return ext.logger.error("Error getting cached content", err);
              if(!("etag" in headers) && !opts.disableAutoETag) headers.etag = sha1(stats.ino.toString() + stats.ctime.toString());
              if(!("last-modified" in headers) && !opts.disableAutoLastModified) headers["last-modified"] = new Date();
              if(!("cache-control" in headers) && !opts.disableAutoCacheControl) headers["cache-control"] = opts.fallbackCacheControlValue;
              if(!("content-length" in headers) && !opts.disableAutoContentLength) headers["content-length"] = stats.size;
              fs.writeFile(dirPath + "/" + [langMatch, contentTypeMatch, encodingMatch, "headers"].join("."), JSON.stringify(headers), function(err){
                if(err) return ext.logger.error("Error while saving headers", err);
              });
            });
          });
          return cb(null, stream);
        } catch(e){return cb(e);}
      });
    });
  };
  
  ext.cacheContent = function(url, headers, content, cb, opts){
    ext.cacheStream(url, headers, function(err, stream){
      if(err) return cb(err);
      stream.end(content);
      cb();
    }, opts);
  };
  
  ext.uncache = function(url, cb) {
    var hashedUrl = sha1(url);
    var dirPath = ext.config.dumpPath + "/" + hashedUrl;
    rmdir(dirPath, cb);
  };
  
  return ext;
}