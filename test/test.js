"use strict";

var NCE = require("nce");
var ExtMgr = require("nce-extension-manager");
var Ext = require("../");
describe('Basic integration in NCE', function(){
  var nce = new NCE({user:{modelName:"user-test1"}});
  it('should be insertable into NCE', function(done){
    var ext = Ext(nce);
    if(ext) return done();
    return done(new Error("Is not able to insert extension into NCE"));
  });
});
describe('Basic functions in NCE', function(){
  var nce = new NCE({user:{modelName:"user-test2"}});
  var ext = Ext(nce);
  var extMgr = ExtMgr(nce);
  extMgr.activateExtension(extMgr);
  extMgr.getActivatedExtension("mongoose-store");
  extMgr.getActivatedExtension("user");
  
  it('should be installable', function(done){
    if(extMgr.installExtension(ext) && ext.status === "installed") return done();
    return done(new Error("Can not install extension"));
  });
  it('should be activatable', function(done){
    if(extMgr.activateExtension(ext) && ext.status === "activated") return done();
    return done(new Error("Can not activate extension"));
  });
  it('should be deactivatable', function(done){
    if(ext.deactivate()) return done();
    return done(new Error("Can not deactivate extension"));
  });
  it('should be uninstallable', function(done){
    if(ext.uninstall()) return done();
    return done(new Error("Can not uninstall extension"));
  });
  
  it('should be installable again', function(done){
    if(ext.install()) return done();
    return done(new Error("Can not install extension"));
  });
  it('should be activatable again', function(done){
    if(ext.activate()) return done();
    return done(new Error("Can not activate extension"));
  });
  it('should be deactivatable again', function(done){
    if(ext.deactivate()) return done();
    return done(new Error("Can not deactivate extension"));
  });
  it('should be uninstallable again', function(done){
    if(ext.uninstall()) return done();
    return done(new Error("Can not uninstall extension"));
  });
});
describe('Methods of the caching extension', function(){
  var nce = new NCE({cache:{dumpPath:__dirname + "/../dump4test", logger:{level:0}}, user:{modelName:"user-test3"}});
  var ext = Ext(nce);
  var extMgr = ExtMgr(nce);
  extMgr.activateExtension(extMgr);
  extMgr.activateExtension(ext);
  
  nce.requestMiddlewares = [];
  
  ext.deactivate();
  ext.uninstall();
  ext.install();
  ext.activate();
  
  it('should cache content without headers and options', function(done){
    ext.cacheContent("/cacheContet/withoutHeaders/withoutOpts", {}, "just a test", done, {});
  });
  it('should get the previous cached content without headers and options', function(done){
    ext.getStream("/cacheContet/withoutHeaders/withoutOpts", {}, function(err, stream){
      if(err) return done(err);
      var concat = [];
      stream.on("data", function(data){
        concat.push(data.toString());
      });
      stream.on("end", function(){
        if(concat.join("") === "just a test") return done();
        return done(new Error("Wrong content loaded from test"));
      });
    });
  });
  it('should prefill a lot of header fields automatically', function(done){
    ext.getStream("/cacheContet/withoutHeaders/withoutOpts", {}, function(err, stream, headers){
      if(err) return done(err);
      stream.close();
      
      if(headers &&
        headers["content-language"] === "en" &&
        headers["content-type"] === "text/html; utf-8" &&
        headers["etag"].length === 40 &&
        (new Date(headers["last-modified"])).getDate() &&
        headers["cache-control"] === "max-age=3600"  &&
        headers["content-length"] === 11
      ) return done();
      return done(new Error("Not set headers automatically"));
    });
  });
  it('should uncache the previous cached content without headers and options', function(done){
    ext.uncache("/cacheContet/withoutHeaders/withoutOpts", done);
  });
  it('should not get the previous uncached content without headers and options', function(done){
    ext.getStream("/cacheContet/withoutHeaders/withoutOpts", {}, function(err){
      if(err && err.message.indexOf("ENOENT")>=0) return done();
      if(err) return done(err);
      return done(new Error("Got a uncached resource"));
    });
  });
  it('should cache content only for one user', function(done){
    ext.cacheContent("/cacheContent/allowUser/test", {}, "just a test", done, {allowUser:{username:"test"}});
  });
  it('should not get the previous cached content without a valid user', function(done){
    ext.getStream("/cacheContent/allowUser/test", {}, function(err){
      if(err && err.message.indexOf("ENOENT")>=0) return done();
      if(err) return done(err);
      return done(new Error("Got a uncached resource"));
    });
  });
  it('should get the previous cached content with a valid user', function(done){
    ext.getStream("/cacheContent/allowUser/test", {}, function(err){
      if(err) return done(err);
      return done();
    }, {username:"test", usergroups:[], email:""});
  });
  it('should not get the previous cached content with the router and an incorrect user', function(done){
    nce.middleware({headers: {}, user: {username:"other", usergroups:[], email:""}, url:"/cacheContent/allowUser/test"}, {on: function(){}, emit: function(){}, once: function(){}, end:function(str){}, writeHead:function(code, headers){if(code === 200) return done(new Error("Sending resource unallowed"));}, write:function(){}}, function(req, res){
      done();
    });
  });
  it('should get the previous cached content with the router and correct user', function(done){
    nce.middleware({headers: {}, user: {username:"test", usergroups:[], email:""}, url:"/cacheContent/allowUser/test"}, {on: function(){}, emit: function(){}, once: function(){}, end:function(str){}, writeHead:function(code, headers){if(code === 200) return done(); done(new Error("Wrong statuscode"));}, write:function(){}}, function(req, res){
      done(new Error("Called unallowed next"));
    });
  });
});