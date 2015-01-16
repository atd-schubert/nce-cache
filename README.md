# Caching extension for NCE
## Description
This is an extension for the [nce framework](https://github.com/atd-schubert/node-nce) for caching content.

## How to install
Install with npm: `npm install --save nce-cache`

Integrate in NCE with the [extension-manager](https://github.com/atd-schubert/nce-extension-manager):

```
var NCE = require("nce");
var nce = new NCE(/*{}*/);
var extMgr = require("nce-extension-manager")(nce);
extMgr.activateExtension(extMgr);

var cache = extMgr.getActivatedExtension("cache");
```

## How to use
This caching extension is able to cache multiple resources on **one** requested url. The extension distinguishes content by the following header fields:
* `Accept` / `Content-Type`
* `Accept-Charset` / `Content-Type`
* `Accept-Language` / `Content-Type`

and delivers (if available) the best content (or just call `next()` to give other extensions the chance to deliver the content).

You are able to use this extension in combination with [nce-user](https://github.com/atd-schubert/nce-user) to provide also cached resources only for authenticated users and you are able to provide cached-content only for specific users.

You are able to uncache resources, or set an expire-header as [ttl](http://en.wikipedia.org/wiki/Time_to_live).

### Config settings
You are able to use the following [config-settings](https://github.com/atd-schubert/node-nce/wiki/Extension-Class#configuration) (listed with their defaults):

* `dumpPath: process.cwd() + "/cache-data"`: Directory to dump files.
* `fallbackContentType: "text/html"`: The fallback content type if resource has none.
* `fallbackLanguage: "en"`: The fallback language if resource has none (if you have [nce-i18n](https://github.com/atd-schubert/nce-i18n) installed this extension take its fallback-language). 
* `fallbackCharset: "utf-8"`: The fallback charset if resource has none.
* `fallbackCacheControlValue: "max-age=3600"`: The fallback value for cache-control header.
* `allowUsers: false`: Proof for valid user with [nce-user](https://github.com/atd-schubert/nce-user) (use like described the options in [this section](https://github.com/atd-schubert/nce-user#checkauthenticationrequest-response-authcb-unauthcb-options)).

* `disableAutoETag: false`: Set to `true` if you don't want to create a ETag for a resource automatically if it has none.
* `disableAutoLastModified: false`: Set to `true` if you don't want to create a last-modified-header for a resource automatically if it has none.
* `disableAutoContentLength: false`: Set to `true` if you don't want to create a header for the content-length of a resource automatically if it has none.
* `disableAutoCacheControl: false`: Set to `true` if you don't want to create a cache-control-header for a resource automatically if it has none.
* `sloppyErrorHandling: false`: Set to `true` if you want to call `next()` on every error thrown by this extension.
* `logger: {}`: Settings for [logger-extension](https://github.com/atd-schubert/nce-winston)

### Basic methods

#### ext.uncache(url, cb)
Uncache a resource by url.

##### Arguments
1. `url`[String]: The url as identifier.
1. `cb`[Function]: Callback-function from [node module rmdir](https://github.com/dreamerslab/node.rmdir) with the arguments:
    1. `error`[Error]: Used for exceptions.
    1. `dir`[Array]: List of deleted directories.
    1. `files`[Array]: List of deleted files.

#### ext.cacheContent(url, headers, content, cb, opts)
Cache a content directly, without a stream.

##### Arguments
1. `url`[String]: The url as identifier.
1. `headers`[Object]: [Headers](http://nodejs.org/api/http.html#http_response_writehead_statuscode_reasonphrase_headers) to be send.
1. `content`[String or Buffer]: The content to cache.
1. `cb`[Function]: Callback-function with the arguments:
    1. `error`[Error]: Used for exceptions.
1. `opts`[Object]: The same options as used with ext.cacheStream(...).

#### ext.cacheStream(url, headers, cb, opts)
Cache content with a write-stream.

##### Arguments
1. `url`[String]: The url as identifier.
1. `headers`[Object]: [Headers](http://nodejs.org/api/http.html#http_response_writehead_statuscode_reasonphrase_headers) to be send.
1. `cb`[Function]: Callback-function with the arguments:
    1. `error`[Error]: Used for exceptions.
    1. `stream`[Stream]: A write stream.
1. `opts`[Object]: All options are optional and get set with the [config-settings](#config-settings)
    * `allowUsers`[Object or false]: Users, usergroups, emails and ids of users that are allowed to access a cached resource. If you don't want to provide a user-authentication set to `false`, otherwise use like described for options on [this method from nce-user](https://github.com/atd-schubert/nce-user#checkauthenticationrequest-response-authcb-unauthcb-options).
    * `disableAutoETag`[Boolean]: Disable or enable just for this resource.
    * `disableAutoLastModified`[Boolean]: Disable or enable just for this resource.
    * `disableAutoContentLength`[Boolean]: Disable or enable just for this resource.
    * `disableAutoCacheControl`[Boolean]: Disable or enable just for this resource.
    * `fallbackContentType`[String]: Fallback value for content-type for this resource.
    * `fallbackCharset`[String]: Fallback value for charset for this resource.
    * `fallbackLanguage`[String]: Fallback value for language for this resource.
    * `fallbackCacheControlValue`[String]: Fallback value for cache-control for this resource.
    * `supported`[Object]: Object of support informations:
        * `languages`[Array]: List of languages supported on this url.
        * `contentTypes`[Array]: List of content-types supported on this url.
        * `charsets`[Array]: List of charsets supported on this url.
    * `fallback`[Object]: Object of fallback informations. You can set to `false` if you want to provide every possibility.
        * `language`[String]: Fallback language.
        * `contentType`[String]: Fallback content-type.
        * `charset`[String]: Fallback charset.

#### ext.getStream(url, headers, cb, user)
Get a cached resource as a stream.

##### Arguments
1. `url`[String]: The url as identifier.
1. `headers`[Object]: [Headers](http://nodejs.org/api/http.html#http_message_headers) from client.
1. `cb`[Function]: Callback-function with the arguments:
    1. `error`[Error]: Used for exceptions.
    1. `stream`[Stream]: A readable stream.
1. `user`[Object]: A valid user object from [nce-user](https://github.com/atd-schubert/nce-user#methods-of-the-user-object).