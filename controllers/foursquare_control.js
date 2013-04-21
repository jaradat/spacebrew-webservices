module.exports = {
    session: {}                    // link to active temboo session
    , model: {                        // holds app configuration and current state information
        "curClientId": 0
        , "clients": {}
		, "page" : {
			"title": "Foursquare in Space"
			, "subtitle": "Forwarding check-ins to spacebrew"			
			, "template": {
				"no_auth": "foursquare_no_auth"
				, "auth": "foursquare"
			}
		}
		, "base_url": "http://localhost:8002"
		, "forwarding_path": "/foursquare/auth?client_id="
		, "authenticated_path": "/foursquare/ready?client_id="
    }
    , utils: require("./utils.js")

    /**
     * init 	Method that initializes the controller object by getting a reference to the
     * 			Temboo session object.
     * @param  {Object} config  Configuration object that includes the auth settings 
     *                          and the session object.
     * @return {Object}         Foursquare control object if config object was valid,
     *                          otherwise it returns an empty object.
     */
    , init: function( config ) {
        if (config["session"]) {
            this.session = config["session"];
            this.model.base_url = config["base_url"];
            this.debug = config["debug"] || false;
	        this.handleAppRequest = this.utils.getHandleAppRequest( this );
	        this.handleAuthenticatedRequest = this.utils.getHandleAuthenticatedRequest( this );
            if (this.debug) console.log("[init:foursquareControl] successfully configured fourquare controller")
            return this;            
        } else {
            if (this.debug) console.log("[init:foursquareControl] unable to configure fourquare controller")
            return {};        
        }
    }

    /**
     * newClient 	Increments the curClientId and then add a new client to the this.model.clients 
     * 				object, assigning to it the new client id.
     * @param  {Object} config      Configuration object with an application name
     * @return {Object}             Returns the client object that was just created
     */
    , newClient: function (config) {
        this.model.curClientId++;               // update curClientId number
        var clientId = this.model.curClientId;  // assign id number for current client
        this.model.clients[clientId] = {        // initialize the current client object
			"id": clientId
			, "query": ""
			, "results": {}
			, "lastestId": 0
			, "reply": undefined
			, "geo": {
				"lat": 0
				, "long": 0
				, "available": false
			},
			"auth": {
				"code": ""
				, "access_token": ""
				, "oath_started": false
			}
			, "query_str": {
				"server": "sandbox.spacebrew.cc"
				, "port": 9000
				, "name": "spacebrew foursquare"
				, "description": "web app that forwards foursquare check-ins to spacebrew"
				, "refresh": undefined
			}
        } 
        return this.model.clients[clientId];    // return reference to current client object
    }

	/**
	 * Points to callback function that handles requests for the twitter app. These requests 
	 * 	are parsed to extract the app name from the URL. Look at the utils.js file for more 
	 * 	details and to see the code for this method. Method is initialized in init function.  
	 */
	, handleAppRequest: function(req, res) { 
		if (this.debug) console.log ("[handleAppRequest] placeholder function is being called") 
	}

	/**
	 * Points to callback function that handles authenticated requests for the instagram app. 
	 * 	These requests need to include the client_id that is matched with an ip address to 
	 * 	confirm authentication.  
	 */
	, handleAuthenticatedRequest: function(req, res) { 
		if (this.debug) console.log ("[handleAuthenticatedRequest] placeholder function is being called"); 
	}

    /**
     * handleOAuthRequest 	Method that handles http requests associated to OAuth athentication for the
     * 						Foursquare app. It leverages Temboo's OAuth API, in a consistent manner.
     * @param  {Request Object} req Express server request object, which includes information about the HTTP request
     * @param  {Response Object} res Express server response object, used to respond to the HTTP request
     */
    , handleOAuthRequest: function(req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , client_id = urlReq.query['client_id'] || -1
            , client = this.model.clients[client_id]
            , Foursquare = require("temboo/Library/Foursquare/OAuth")
            , oauthChoreo = undefined
            , oauthInputs = undefined
            , self = this
            ; 

        if (this.debug) console.log("[handleOAuthRequest] current client's model: ", this.model.clients[client_id])

        // handle first step of the OAuth authentication flow
		if (!this.model.clients[client.id].auth.oath_started) {
            if (this.debug) console.log("[handleOAuthRequest] step 1 - client id ", client.id)

			oauthChoreo = new Foursquare.InitializeOAuth(self.session);

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('FoursquareSpacebrewForwarder');
			oauthInputs.set_ForwardingURL(this.model.base_url + this.model.forwarding_path + client.id)

			var intitializeOAuthCallback = function(results){
			    	if (self.debug) console.log("[intitializeOAuthCallback:handleOAuthRequest] initial OAuth successful ", results.get_AuthorizeURL());
			    	self.model.clients[client_id].auth.callback_id = results.get_CallbackID();
			    	self.model.clients[client.id].auth.oath_started = true;
			    	res.redirect(results.get_AuthorizeURL());		
			    }

			oauthChoreo.execute(
			    oauthInputs,
			    intitializeOAuthCallback,
			    function(error){
			    	console.log("ERROR: start OAuth", error.type); 
			    	console.log(error.message);
			    }
			);
		}

        // handle second step of the OAuth authentication flow
		else {
            if (this.debug) console.log("[handleOAuthRequest] step 2 - client id ", client.id)

		    oauthChoreo = new Foursquare.FinalizeOAuth(self.session)

			oauthInputs = oauthChoreo.newInputSet();
			oauthInputs.setCredential('FoursquareSpacebrewForwarder');
			oauthInputs.set_CallbackID(self.model.clients[client_id].auth.callback_id);

			var finalizeOAuthCallback = function(results){
		    	if (self.debug) console.log("[finalizeOAuthCallback:handleOAuthRequest] finish OAuth successful");
		    	self.model.clients[client_id].auth.access_token = results.get_AccessToken();
		    	res.redirect(self.model.base_url + self.model.authenticated_path + client_id);
		    }

			// Run the choreo, specifying success and error callback handlers
			oauthChoreo.execute(
			    oauthInputs,
			    finalizeOAuthCallback,
			    function(error){
			    	console.log("ERROR: final OAuth", error.type); 
			    	console.log(error.message);
			    }
			);
		} 
    }

    /**
     * handleQueryRequest 		Callback function that handles ajax requests for new content. The query 
     * 							string in the URL for each request includes a client id and optional params, 
     * 							such as long and latitude. These are used to make the appropriate request to 
     * 							foursquare via Temboo. A reply callback method is added to the client object. 
     * 							This method is used by the queryTemboo function to respond to the ajax request 
     * 							once it receives a response from the foursquare server.
     *        
     * @param  {Request Object} req 	Express server request object, which includes information about the 
     *                          		HTTP request
     * @param  {Response Object} res 	Express server response object, used to respond to the HTTP request
     */
    , handleQueryRequest: function (req, res) {
        var urlReq = require('url').parse(req.url, true)    // get the full URL request
            , queryJson = JSON.parse(unescape(urlReq.search.replace(/\?/, "")))       // convert string to json (unescape to convert string format first)
            , client                                        // will hold client object
            , self = this
            ;

        if (this.debug) console.log("[handleQueryRequest] query string in json: ", queryJson)

        // if no client id is provided, or client id is invalid, then send user back to unauthorized page
        if (!queryJson.id || !this.model.clients[queryJson.id]) {
            res.redirect( "/foursquare"); 
        } 

        // if geo filter data is available, then store it in the appropriate client
        if (queryJson.data.optional.geo) {
            // if any of the geo filter attributes have changed then update the client object 
            if ((queryJson.data.optional.geo.lat != this.model.clients[queryJson.id].geo.lat) || 
                (queryJson.data.optional.geo.long != this.model.clients[queryJson.id].geo.long) ||
                (queryJson.data.optional.geo.available != this.model.clients[queryJson.id].geo.available)) 
            {
                if (this.debug) console.log("[handleQueryRequest] geocode included : ", queryJson.geo);        
                this.model.clients[queryJson.id].geo.lat = queryJson.data.optional.geo.lat;
                this.model.clients[queryJson.id].geo.long = queryJson.data.optional.geo.long;
                this.model.clients[queryJson.id].geo.available = queryJson.data.optional.geo.available;                
                this.model.clients[queryJson.id].lastestId = 0;     // reset last ID to 0
            }
        }

        // // set the ajax_req flag to true and create the callback function
        this.model.clients[queryJson.id].reply = function(data) {
            if (self.debug) console.log("[reply:handleQueryRequest] callback method, rendering data: ", data);
            res.end(data);                
        }

        this.queryTemboo(queryJson.id, "reply");
    }

    /**
     * queryTemboo Function that submits foursquare API requests via the Temboo API engine. 
     * @param  {Integer}    clientId        Id of the client that submitted this query
     * @param  {String}     callbackName    Name of callback method that should be called when results data
     *                                      is received. If none is proved then it will default to reply.
     */
    , queryTemboo: function (clientId, callbackName) {
        var searchT = this.model.clients[clientId].query
            , geocodeT = this.model.clients[clientId].geo
            , callbackName = callbackName || "reply"
            , foursquare = require("temboo/Library/Foursquare/Checkins")
            , queryChoreo = new foursquare.RecentCheckins(this.session)
            , queryInputs = queryChoreo.newInputSet()
            , self = this
            ;

        if (this.debug) console.log("[queryTemboo] new request made: ", searchT);
        if (this.debug) console.log("[queryTemboo] geocode: ", geocodeT);
        if (this.debug) console.log("[queryTemboo] auth token: ",this.model.clients[clientId].auth.access_token)

        if (!this.utils.isString(searchT)) return;    // return if search term not valid

        // set-up the temboo service connection
        // var Foursquare = require("temboo/Library/Foursquare/Checkins");
        // var queryChoreo = new foursquare.RecentCheckins(this.session);
        // var queryInputs = queryChoreo.newInputSet();
        
        // Instantiate and populate the input set for the choreo
        queryInputs.set_ResponseFormat("json");     // requesting response in json
        queryInputs.set_OauthToken(this.model.clients[clientId].auth.access_token);
        if (this.model.clients[clientId].geo.available) {
            if (this.debug) console.log("[queryTemboo] geo code data available: ");
            queryInputs.set_Latitude(this.model.clients[clientId].geo.lat);     // requesting response in json
            queryInputs.set_Longitude(this.model.clients[clientId].geo.long);     // requesting response in json            
        }
        queryInputs.set_AfterTimeStamp(this.model.clients[clientId].createdAt);

        /**
         * successCallback Method that is called by the temboo API when the results from twitter are
         *     returned. It process the data and calls the client's handler method to forward the
         *     data back to the front end
         * @param  {Temboo Results Obect} results Results from Temboo Foursquare service query
         */
        var successCallback = function(results) {
            var tResults = JSON.parse(results.get_Response())
                , results_list = []
                , newCheckIn = {} 
                ;

            if (this.debug) console.log( "[successCallback:queryTemboo] results received - json: ", tResults );

            // check if results received by verifying that tResults object contains a response.recent attribute
            if (tResults["response"]) {
                if (tResults.response["recent"]) {

                    // store the results in the appropriate client
                    self.model.clients[clientId].results = tResults.response["recent"];

                    // loop through each check-in to parse and store the data
                    for(var i = tResults.response["recent"].length - 1; i >= 0; i--) {
                    	// make sure id is a number not a string
		                self.model.clients[clientId].results[i].id = Number(self.model.clients[clientId].results[i].id);

                        // if this is a new check-in then process it
                        if (self.model.clients[clientId].results[i].createdAt > self.model.clients[clientId].lastestId) {

                            newCheckIn = {
                                "user": tResults.response["recent"][i].user.firstName + " " + tResults.response["recent"][i].user.lastName,
                                "photo": tResults.response["recent"][i].user.photo,
                                "venue": tResults.response["recent"][i].venue.name,
                                "address": tResults.response["recent"][i].venue.location.address,
                                "lat": tResults.response["recent"][i].venue.location.lat,
                                "long": tResults.response["recent"][i].venue.location.lng,
                                "city": tResults.response["recent"][i].venue.location.city,
                                "state": tResults.response["recent"][i].venue.location.state,
                                "country": tResults.response["recent"][i].venue.location.country,
                                "checkinsCount": tResults.response["recent"][i].venue.stats.checkinsCount,
                                "createdAt": tResults.response["recent"][i].createdAt,
                                "id": tResults.response["recent"][i].createdAt,
                            };

                            if (self.debug) console.log( "[successCallback:queryTemboo] new check-in created, index number: " + i, newCheckIn);

                            // add new checkin to checkIns array
                            results_list.push(newCheckIn);

                            // update the id of the most recent message
                            self.model.clients[clientId].lastestId = self.model.clients[clientId].results[i].createdAt;
                        }
                    }
                }

                // call appropriate response methods for client that made request
                if (self.model.clients[clientId][callbackName]) {
                    var reply_obj = { "list" : results_list };
                    if (self.debug) console.log("\n[successCallback:queryTemboo] sending json response: ", JSON.stringify(reply_obj));
                    self.model.clients[clientId][callbackName](JSON.stringify(reply_obj));
                }
            }
        };

        // Run the choreo, passing the success and error callback handlers
        queryChoreo.execute(
            queryInputs,
            successCallback,
            function(error) {
            	console.log(error.type); 
            	console.log(error.message);
            }
        );
    }

	/**
	 * isString Function that checks whether an object is a string
	 * @param  {Object}  obj Object that will be checked to confirm whether it is a string
	 * @return {Boolean}     Returns true if the object was a string. False otherwise.
	 */
	// isString: function (obj) {
	//     return toString.call(obj) === '[object String]';
	// }
}