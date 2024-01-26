const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const json2html = require('node-json2html');
const ds = require('./datastore');
const datastore = ds.datastore;
const BOAT = "Boats";
const LOAD = "Loads";
const OWNER = "Owners";

const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');
const { PropertyFilter } = require('@google-cloud/datastore');

router.use(bodyParser.json());


const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const DOMAIN = process.env.DOMAIN;

// CONSTANTS
const MA400 = 'INVALID REQUEST: The request object is missing an attribute.';
const EMPTY400 = 'INVALID REQUEST: Empty body is not allowed.';
const E401USER = 'INVALID REQUEST: Unauthorized User.';
const E406 = "INVALID REQUEST: Not an Acceptable Media Type.";
const E415 = "INVALID REQUEST: The server accepts 'application/json' requests only."
const IA400 = 'INVALID REQUEST: An invalid attribute value detected.'
const NE400 = 'INVALID REQUEST: This attribute does not exist for this boat_id.';
const E404 = "INVALID REQUEST: No boat with this boat_id exists." ;
const E405 = 'INVALID REQUEST: This method is not supported at this endpoint.';
const E403 = "INVALID REQUEST: The request object does not have a unique name value.";
const E403LOADED = "INVALID REQUEST: The load is already loaded on another boat.";
const WO401 = 'INVALID REQUEST: This owner_id has no relation with this boat_id.';

// ############################### JWT ##############################
const checkJwt = jwt(
    {
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${DOMAIN}/.well-known/jwks.json`
    }),
    onExpired: async (req, err) => {
        if (new Date() - err.inner.expiredAt < 5000) {return;}
        throw err;
    },
    credentialsRequired: false,
    // Validate the audience and the issuer.
    issuer: `https://${DOMAIN}/`,
    algorithms: ['RS256']
});

// ############################### JWT ##############################

/* ------------- Begin Boats Model Functions ------------- */
// list all boats:
function list_boats(req){
    const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(ds.fromDatastore);
		});
}

function list_public_boats(req){
	var q = datastore.createQuery(BOAT)
    .filter(
        new PropertyFilter('public', '=', true)
    )
    .limit(5);
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        let decoded = decodeURIComponent(req.query.cursor);
        q = q.start(decoded);
    }
    return datastore.runQuery(q).then( (entities) => {
        results.boats = entities[0].map(ds.fromDatastore);
        if ((entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS )) {
            let encoded = encodeURIComponent(entities[1].endCursor);
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encoded;
        }  // the last page of results shouldn't have a next button
        return results;
    });
}

function list_owners_boats(req, sub) {
    var q = datastore.createQuery(BOAT)
    .filter(
        new PropertyFilter('owner.sub', '=', sub)
    )
    .limit(5);
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        let decoded = decodeURIComponent(req.query.cursor);
        q = q.start(decoded);
    }
    return datastore.runQuery(q).then( (entities) => {
        results.boats = entities[0].map(ds.fromDatastore);
        if ((entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS )) {
            let encoded = encodeURIComponent(entities[1].endCursor);
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encoded;
        }  // the last page of results shouldn't have a next button
        return results;
    });
}

function post_boat(attributes) {
    /* for post, create the initial item and then in the controller, patch it? */
    // key == datastore's entity's key
    // find the key of the kind == BOAT
    const key = datastore.key(BOAT);
    var valid = false; 
    let data = {};
    for (let i = 0; i < attributes.length; i++) {
        data[attributes[i][0]] = attributes[i][1];
    }
    if (data.length !== 0) {
        return datastore.save({ "key": key, "data": data })
            .then(() => { return key });
    } else {
        return valid;
    }
}

// get a single boat with boat_id
function get_boat(id) {
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        // no entity/item found
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            // object/item exists
            return entity.map(ds.fromDatastore);
        }
    });
}

// delete a boat with boat_id
function delete_boat(id) {
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return datastore.delete(key);
}

// get's owner's id using the sub attribute
function get_owner(sub) {
    return list_owners().then( (owners) => {
        for (let i = 0; i < owners.length; i++) {
            if (owners[i].sub == sub) {
                return owners[i];
            }
        }
    })
}

function list_owners() {
    const q = datastore.createQuery(OWNER);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(ds.fromDatastore);
		});
}

// rendering JSON into HTML for GET 
function htmlrender(req, data) {
    let sending_info = [];
    for (let i = 0; i < Object.keys(data).length; i++) {
        let key = Object.keys(data)[i];
        let value = Object.values(data)[i];
        let fixed_data  = {"key": `${key}: ${value}`, "attribute": `${key}`};
        sending_info.push(fixed_data);
    }
    let template = {'<>': 'li', 'id':'${attribute}', 'class': 'boat-attribute', 'html': '${key}'};
    // adding the self attribute
    let self_url = req.protocol + "://" + req.get("host") + req.baseUrl + '/' + data.id;
    sending_info.push({"key": `self: ${self_url}`, "attribute": "self"});
    return json2html.render(sending_info, template);
};

function validate(reqInputs, reqInputTypes) {
    let test = true;
    for (let i = 0; i < reqInputTypes.length; i++) {
        if ((reqInputs[i][0] === 'req.body.name') && (reqInputs[i][1] !== null) && (reqInputs[i][1] !== undefined)){
            // length of input test.
            if (reqInputs[i][1].length > 50) {
                test = false;
                break;
            } //regex for valid characters : letters and numbers
            if (reqInputs[i][1].match(/^[A-Za-z0-9 ]*$/)) {
            } else {
                test = false;
                break;
            }
        }
        if ((reqInputs[i][0] === 'req.body.type') && (reqInputs[i][1] !== null) && (reqInputs[i][1] !== undefined)){
            // length of input test.
            if (reqInputs[i][1].length > 50) {
                test = false;
                break;
            } //regex for valid characters : letters and numbers
            if (reqInputs[i][1].match(/^[A-Za-z0-9 ]*$/)) {
            } else {
                test = false;
                break;
            }
        }

        if ((reqInputs[i][0] === 'req.body.length')  && (reqInputs[i][1] !== null) && (reqInputs[i][1] !== undefined)){
            // length of input test.
            if ((reqInputs[i][1].toString()).length > 10) {
                test = false;
                break;
            } //regex for valid characters : letters and numbers
            if ((reqInputs[i][1].toString()).match(/^[1-9]\d*(\.\d+)?$/)) {
            } else {
                test = false;
                break;
            }
        }
        if ((reqInputs[i][0] === 'req.body.public') && (typeof(reqInputs[i][1]) !== 'boolean')) {
            test = false;
            break;
        }
    } return test;
}

function uniqueName(req, id, name) {
    // check if the name exists in any other boat
    let unique = true;
    return boatlist = list_boats(req).then( (boats) => {
        
        for (let i = 0; i < boats.length; i++) {
            if ((boats[i].name === name) && (id !== boats[i].id)) {
                unique = false;
                break;
            }
            else if ((boats[i].name === name) && (id === -1)) {
                unique = false;
                break;
            }
        }
        return unique;
    })
};

function deload_from_boat(boat_id, req_data, boat_data) {
    const key = datastore.key([BOAT, parseInt(boat_id,10)]);
    boat_data["loads"] = req_data
    return datastore.save({"key":key, "data":boat_data});
};

function boat_num(req) {
    var q = datastore.createQuery(BOAT);
    return datastore.runQuery(q).then( (entities) => {
        return entities[0].length;
    });
};

function owner_boat_num(req) {
    var q = datastore.createQuery(BOAT)
    .filter(
        new PropertyFilter('owner.sub', '=', req.auth.sub)
        );
    return datastore.runQuery(q).then( (entities) => {
        return entities[0].length;
    });
};

// can only fix pre-existing data
function patch_boat(id, req_data, boat_data) {
    const key = datastore.key([BOAT, parseInt(id,10)]);
    for (let i = 0; i < Object.keys(req_data).length; i++) {
       if (Object.keys(req_data)[i] in boat_data) {
        boat_data[Object.keys(req_data)[i]] = Object.values(req_data)[i];
       }
    }
    return datastore.save({"key":key, "data":boat_data});
}

function put_boat(id, req_data, boat_data){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    for (let i = 0; i < Object.keys(req_data).length; i++) {
        boat_data[Object.keys(req_data)[i]] = Object.values(req_data)[i];
    }
    return datastore.save({"key":key, "data":boat_data});
};

function load_check(id) {
    // given the id of the boat, check if the boat has loads
    // returns the full boat object if load exists?
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        // no entity/item found
        if (entity[0]["loads"] === undefined || entity[0]["loads"] === null) {
            return false;
        } else {
            // object/item exists
            return entity.map(ds.fromDatastore);
        }
    });
}
function get_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        // no entity/item found
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            // object/item exists
            return entity.map(ds.fromDatastore);
        }
    });
}
function deload(id, load_data) {
    const key = datastore.key([LOAD, parseInt(id,10)]);
    load_data["carrier"] = null;
    return datastore.save({"key":key, "data":load_data});
}

// PUT - assign a load to a boat
function assign_load(boat_id, load_id){
    const b_key = datastore.key([BOAT, parseInt(boat_id,10)]);
    return datastore.get(b_key)
    .then( (boat) => {
        if( typeof(boat[0].loads) === 'undefined'){
            boat[0].loads = [];
        }
        boat[0].loads.push({'id' : load_id});
        return datastore.save({"key":b_key, "data":boat[0]});
    });
}

//  - adding carrier to load data
function assign_carrier(boat_id, load_id, boat_info, load_info) {
    const key = datastore.key([LOAD, parseInt(load_id,10)]);
    const carrier_info = {"id": boat_id, "name": boat_info.name}
    const load_data = { "volume": load_info.volume, "carrier": carrier_info, "item": load_info.item, "origin": load_info.origin}
    return datastore.save({"key": key, "data": load_data})
}

function add_boat(owner_id, boat_id, owner_info) {
    const key = datastore.key([OWNER, parseInt(owner_id,10)]);
    const boat_info = {"id": boat_id}
    let new_info = owner_info['boats'];
    new_info.push(boat_info);
    return datastore.save({"key": key, "data": owner_info})
}

function url_maker(req, object, base, id) {
    // if object has owner attribute 
    if (object.owner !== null || object.owner !== undefined) {
        let owner_url = req.protocol + "://" + req.get("host") + '/owners' + '/' + object.owner.id;
        object["owner"]["self"] = owner_url;
    }
    // if loads
    if (object.loads !== null || object.loads !== undefined) {
        let load_urls = [];
        for (let i = 0; i < object.loads.length; i++) {
            let load_url = req.protocol + "://" + req.get("host") + '/loads' + '/' + object.loads[i].id;
            object["loads"][i]["self"] = load_url;
            load_urls.push({'id' : object.loads[i], 'self': load_url})
        }
        object["loads"]["self"] = load_urls;
    }
    let url = req.protocol + "://" + req.get("host") + '/' + base + '/' + id;
    object["self"] = url;
    return object
}


function unassign_boat(id, owner, boat_id) {
    // unassign boat from owner
    const key = datastore.key([OWNER, parseInt(id,10)]);
    let new_boats = [];
    for (let i = 0; i < owner['boats'].length; i++) {
      if (owner.boats[i].id !== boat_id) {
        new_boats.push(owner.boats[i]);
      }
    }
    owner.boats = new_boats;
    return datastore.save({"key":key, "data": owner})
}

// /* ------------- End Boats Model Functions ------------- */

/* ------------- Begin Boats Controller Functions ------------- */
// GET /boats
    // no auth: returns all public boats
    // auth: returns only the user's boats
router.get('/', checkJwt, function(req, res) {
    // no auth - return all public boats
    // CHECK IF PRIVATE BOATS GET SENT
    if (!req.auth) {
        list_public_boats(req).then((boats) => {
            let data = [];
            for (let i = 0; i < boats['boats'].length; i++) {
                let boat = url_maker(req, boats['boats'][i], 'boats', boats['boats'][i].id);
                data.push(boat)
            }
            boat_num(req).then( (num) => {
                let returning_info = {"total": num, 'boats' : data, "next": boats["next"]}
            return res.status(200).json(returning_info);
            })
            
        });
    }
    // auth - return all of the owner's boats 
    else {
        let owner = req.auth.sub;
        list_owners_boats(req, owner).then((boats) =>{
            let data = [];
            for (let i = 0; i < boats['boats'].length; i++) {
                let boat = url_maker(req, boats['boats'][i], 'boats', boats['boats'][i].id);
                data.push(boat)
            }
            owner_boat_num(req).then( (num) => {
                let returning_info = {"total": num, 'boats' : data, "next": boats["next"]}
                return res.status(200).json(returning_info);
            })
        });
    }      
});

// GET /boats/:boat_id
// no auth: returns all public boats
// auth: returns only the user's boats
router.get('/:boat_id', checkJwt, function(req, res) {
    const accepts = req.accepts(['application/json', 'text/html']);
    if (!accepts) {
        // not an aceptable format
        res.status(406).json({'Error' : E406});
    } 
    // acceptable 
    else {
        // check for auth
        if (!req.auth) {
            res.status(401).json({ 'Error' : E401USER });
        } 
        // valid auth
        else {
            get_boat(req.params.boat_id).then( (boat) => {
                // no boat with this id
                if (boat[0] === undefined || boat[0] === null) {
                    res.status(404).json({ 'Error': 'INVALID REQUEST: No boat with this boat_id exists.'});
                }
                // valid boat
                else {
                    // no owner
                    if (boat[0].owner === null) {
                        res.status(404).json({ 'Error' : 'INVALID REQUEST: This boat has no owner.'});
                    }
                    // correct owner
                    else if (boat[0].owner.sub !== req.auth.sub) {
                        res.status(401).json({'Error': 'INVALID REQUEST: This owner_id does not own this boat.'});
                    }
                    else if (accepts === 'application/json') {
                        let object = url_maker(req, boat[0], 'boats', req.params.boat_id);
                        res.status(200).json(object);
                    } else if (accepts === 'text/html') {
                        res.status(200).send(htmlrender(req, boat[0]))
                    } else {
                        res.status(500).json({'Error': 'INVALID REQUEST: Content type got messed up!'});
                    }
                }
            })
        }
    }
});
router.post('/', checkJwt, function (req, res) {
    // invalid jwt
    if (!req.auth){
        res.status(401).json({'Error': E401USER});
    }
    // valid jwt
    else {
        const accepts = req.accepts(['application/json']);
        // if the request wasn't sent with application/json
        if(req.get('content-type') !== 'application/json'){
            res.status(415).json({'Error': E415})
        } else if (!accepts) {
            res.status(406).json({'Error': E406})
        } 
        // valid jwt
        else {
            // empty body
            if (req.body === null || req.body === undefined || Object.keys(req.body).length === 0) {
                res.status(400).json({'Error': EMPTY400});
            }
            // required attributes weren't filled
            else if (req.body.name === undefined || req.body.type === undefined || req.body.length === undefined ||  req.body.public === undefined) {
                res.status(400).json({ 'Error': MA400 });
            } 
            // all required attributes were filled.
            else {
                // validate incoming attributes
                reqInputs = [["req.body.name", req.body.name], ["req.body.type", req.body.type], ["req.body.length", req.body.length], ["req.body.public", req.body.public]];
                reqInputTypes = ["string", "string", "float", "boolean"]
                const validation = validate( reqInputs, reqInputTypes);
                if (validation === false) {
                    res.status(400).json({ 'Error': IA400 });
                }
                // if the required attributes aren't missing
                else {
                    // if required attributes aren't missing:
                    uniqueName(req, -1, req.body.name).then( (validName) => {
                        if (validName === true) {
                            if (req.body.name !== undefined && req.body.type !== undefined && req.body.length !== undefined && req.body.public !== undefined) {
                                // #### putting all the req body into a list //
                                let reqArgs = [];
                                for (let i = 0; i < Object.keys(req.body).length; i++) {
                                    let reqBodyKey = Object.keys(req.body)[i];
                                    let reqBodyValue = Object.values(req.body)[i];
                                    reqArgs.push([reqBodyKey, reqBodyValue]);    
                                }
                                reqArgs.push(["loads", []]);
                                get_owner(req.auth.sub).then( (owner_object) => {
                                    let owner_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + owner_object.id;
                                    let owner_info = {"id": owner_object.id, "sub": req.auth.sub};
                                    reqArgs.push(["owner", owner_info]);
                                    post_boat(reqArgs)
                                        .then(key => {
                                        // key returned is the entity's key
                                        var url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
                                        get_boat(key.id).then( (sending_boat) => {
                                            sending_boat[0]["owner"]["self"] = owner_url;
                                            sending_boat[0]["self"] = url;  
                                            // update owner information:
                                            add_boat(owner_object.id, key.id, owner_object).then(res.status(201).json(sending_boat[0]))
                                            
                                        })
                                    })        
                                }) 
                        } else {
                            res.status(400).json({ 'Error': MA400 });
                        } 
                    } else {
                        res.status(403).json({ 'Error': E403 });
                    }
                    })
                }
            }
        }
    }
});

// UPDATE - PUT - change whole attributes of the boat
router.put('/:boat_id', checkJwt, function (req, res){
    const accepts = req.accepts(['application/json']);
    if(req.get('content-type') !== 'application/json'){
        res.status(415).json({'Error': E415});
    } else if (!accepts) {
        res.status(406).json({'Error': E406})
    }  
    else if (typeof(req.body.id) !== 'undefined' || req.body.id !== undefined) {
        if (req.body.id !== req.params.boat_id) {
            res.status(400).json({'Error' : 'INVALID REQUEST: The id cannot be edited.'})
        }
    } else if (req.body === null || req.body === undefined || Object.keys(req.body).length === 0) {
        res.status(400).json({'Error': EMPTY400 });
    } else if ((req.body.name === null || req.body.name === undefined) || (req.body.type === null || req.body.type === undefined) || (req.body.length === null || req.body.length === undefined) || (req.body.public === null || req.body.public === undefined)) {
        res.status(400).json({'Error': MA400})
    }
    else if (! req.auth) {
        res.status(401).json({ 'Error' : E401USER })
    }
    else {
        get_boat(req.params.boat_id)
            .then( (boat) => {
                if (boat[0] === undefined || boat[0] === null) {
                    // check for unique name
                    res.status(404).json({'Error' : E404});
                }
                else if (req.auth.sub !== boat[0].owner.sub) {
                    res.status(401).json({ 'Error' : WO401 });
                } 
                else {
                    reqInputs = [["req.body.name", req.body.name], ["req.body.type", req.body.type], ["req.body.length", req.body.length], ["req.body.public", req.body.public]];
                    reqInputTypes = ["string", "string", "float", "boolean"]
                    const validation = validate( reqInputs, reqInputTypes);
                    if (validation === false) {
                        res.status(400).json({ 'Error': IA400 });
                    }
                    // valid boat id
                    else if ((req.body.name !== undefined || req.body.name !== null) && (req.body.type !== undefined || req.body.type !== null) && (req.body.length !== undefined || req.body.length !== null) && (req.body.public !== undefined || req.body.public !== null)) {
                        const uniqueValidity = uniqueName(req, req.params.boat_id, req.body.name)
                            .then( (result) => {
                                // if unique name constraint is violated
                                if (result === false) {
                                    res.status(403).json({'Error' : E403})
                                } else {
                                    put_boat(req.params.boat_id, req.body, boat[0])
                                            .then( (patched) => {
                                                let object = url_maker(req, boat[0], "boats", req.params.boat_id);
                                                res.status(201).json(object);
                                        })                           
                                }
                            })
                        } else {
                            // if boat isn't updating name
                            put_boat(req.params.boat_id, req.body, boat[0])
                                .then( (result) => {
                                let url = req.protocol + "://" + req.get("host") + req.baseUrl + '/' + req.params.boat_id;        
                                boat[0]["self"] = url;
                                res.status(204).json();
                                     
                }) 
                        }
                    }
            })
         
    }
});

// UPDATE - PATCH - change whole attributes of the boat
router.patch('/:boat_id', checkJwt, function (req, res){
    const accepts = req.accepts(['application/json']);
    if(req.get('content-type') !== 'application/json'){
        res.status(415).json({'Error': E415});
    } else if (!accepts) {
        res.status(406).json({'Error': E406})
    }  
    else if (typeof(req.body.id) !== 'undefined' || req.body.id !== undefined) {
        if (req.body.id !== req.params.boat_id) {
            res.status(400).json({'Error' : 'INVALID REQUEST: The id cannot be edited.'})
        }
    } else if (req.body === null || req.body === undefined || Object.keys(req.body).length === 0) {
        res.status(400).json({'Error': EMPTY400 });
    }
    else if (! req.auth) {
        res.status(401).json({ 'Error' : E401USER })
    }
    else {
        // check body attributes validity
        // validate the incoming attributes to be what's allowed:
        get_boat(req.params.boat_id)
            .then( (boat) => {
                if (boat[0] === undefined || boat[0] === null) {
                    // check for unique name
                    res.status(404).json({'Error' : E404});
                }
                else if (boat[0].owner === null) {
                    res.status(401).json({ 'Error' : 'INVALID REQUEST: This owner_id has no relation with this boat_id.' });
                } 
                else if (req.auth.sub !== boat[0].owner.sub) {
                    res.status(401).json({ 'Error' : WO401})
                }
                // checking if we're trying to edit the id 
                else if (req.body === null || req.body === undefined || Object.keys(req.body).length === 0) {
                    res.status(400).json({'Error': EMPTY400});
                }
                else if (typeof(req.body.id) !== 'undefined' || req.body.id !== undefined) {
                    if (req.body.id !== req.params.id) {
                        res.status(400).json({'Error' : 'INVALID REQUEST: The id cannot be edited.'})
                    }
                }
                // tries to edit id
                else {
                    reqInputs = [["req.body.name", req.body.name], ["req.body.type", req.body.type], ["req.body.length", req.body.length], ["req.body.public", req.body.public]];
                    reqInputTypes = ["string", "string", "float", "boolean"]
                    const validation = validate( reqInputs, reqInputTypes);
                    if (validation === false) {
                        res.status(400).json({ 'Error': IA400 });
                    }
                    // valid boat id
                    else if ((req.body.name !== undefined || req.body.name !== null) && (req.body.type !== undefined || req.body.type !== null) && (req.body.length !== undefined || req.body.length !== null) && (req.body.public !== undefined || req.body.public !== null)) {
                        const uniqueValidity = uniqueName(req, req.params.boat_id, req.body.name)
                            .then( (result) => {
                                // if unique name constraint is violated
                                if (result === false) {
                                    res.status(403).json({'Error' : E403})
                                } else {
                                    patch_boat(req.params.boat_id, req.body, boat[0])
                                            .then( (patched) => {
                                                let object = url_maker(req, boat[0], "boats", req.params.boat_id);
                                                res.status(201).json(object);
                                        })                           
                                }
                            })
                        } else {
                            // if boat isn't updating name
                            patch_boat(req.params.boat_id, req.body, boat[0])
                                .then( (result) => {
                                let url = req.protocol + "://" + req.get("host") + req.baseUrl + '/' + req.params.boat_id;        
                                boat[0]["self"] = url;
                                res.status(204).json();     
                }) 
                        }
                    }
            })
         
    }
});

// LOADING - PATCH - put on a load and update the load
router.patch('/:boat_id/loads/:load_id', checkJwt, function(req, res){
    // CHECK FOR AUTH
    if (!req.auth) {
        res.status(401).json({ 'Error' : E401USER});
    }
    // VALID AUTH
    else {
        // check if boat id is valid
        get_boat(req.params.boat_id).then( (boat) => {
            if (boat[0] === undefined || boat[0] === null) {
                res.status(404).json({ 'Error' : 'INVALID REQUEST: The specified boat and/or load does not exist.'});
            } 
            else if (boat[0].owner.sub !== req.auth.sub) {
                res.status(401).json({ 'Error' : WO401 });
            } 
            else {
                // with valid boat, check load id validity:\
                get_load(req.params.load_id).then((load) => {
                    if (load[0] === null || load[0] === undefined) {
                        res.status(404).json({'Error' : 'INVALID REQUEST: The specified boat and/or load does not exist.'});
                    } else if (load[0]["carrier"] === null) {
                        // we're free to add
                        assign_load(req.params.boat_id, req.params.load_id, boat[0], load[0])
                        .then( (results) => {
                            assign_carrier(req.params.boat_id, req.params.load_id, boat[0], load[0])
                            .then(res.status(204).json())
                        });
                    } else {
                        // if the load already has a carrier
                        res.status(403).json({ 'Error' : E403LOADED });
                    }
                })
            }
        })
    }
});

// LOADING - PATCH - take off a load and update the load
router.delete('/:boat_id/loads/:load_id', checkJwt, function (req, res) {
    if (!req.auth) {
        res.status(401).json({'Error': E401USER});
    }
    else {
        get_boat(req.params.boat_id).then((boat) => {
            if (boat[0] === undefined || boat[0] === null) {
                res.status(404).json({'Error': 'No boat with this boat_id exists.'});
            } // correct owner?
            else if (boat[0].owner === null || boat[0].owner === undefined) {
                res.status(403).json({'Error' : 'INVALID REQUEST: This boat has no owner.'})
            }
            else if (boat[0].owner.sub !== req.auth.sub) {
                res.status(401).json({'Error': 'INVALID REQUEST: This valid user has no relation with this boat.'});
            } 
            else{
                // check load validity
                get_load(req.params.load_id).then( (load) => {
                    if (load[0] === null || load[0] === undefined) {
                        res.status(404).json({'Error' : 'No boat with this boat_id is loaded with the load with this load_id.'});
                    } else {
                        // if this load is not on this boat 
                        let loaded = false;
                        for (let i = 0; i < Object.values(boat[0]["loads"]).length; i++) {
                            if (boat[0]["loads"][i].id === req.params.load_id) {
                                loaded = true;
                                break
                            }
                        }
                        if (!(loaded)) {
                            res.status(404).json({'Error' : 'INVALID REQUEST: No boat with this boat_id is loaded with the load with this load_id.'});
                        } 
                        else {
                            deload(req.params.load_id, load[0]).then( (results) => {
                                let load_ids = [];
                                for (let i = 0; i < boat[0]["loads"].length; i++) {
                                    if (boat[0]["loads"][i].id !== req.params.load_id) {
                                        load_ids.push(boat[0]["loads"][i]);
                                    }
                                }
                                deload_from_boat(req.params.boat_id, load_ids, boat[0]).then(res.status(204).json());
                                
                            })
                        }
                        
                    }
                })
            }
        })
    }
    
})

// DELETE boat
router.delete('/:id', checkJwt, function(req, res) {
    const accepts = req.accepts(['application/json']);
    if (!accepts) {
        res.status(406).json({'Error': E406})
    }  
    // invalid jwt
    else if (!req.auth) {
        res.status(401).json({'Error': 'INVALID REQUEST: Unauthorized user.'});
    }
    //valid jwt
    else {
        // check if boat exists
        get_boat(req.params.id).then( (boat) => {
            // if boat doesn't exist:
            if (boat[0] === undefined || boat[0] === null) {
                res.status(404).json({'Error' : 'INVALID REQUEST: No boat with this boat_id exists.'});
            } else {
                // get owner of the boat
                if (boat[0].owner) {
                    if (boat[0].owner.sub !== req.auth.sub) {
                        return res.status(403).json({'Error': "INVALID REQUEST: This owner does not own this boat."});   
                    } 
                    // if there is an owner - unassign them
                    get_owner(req.auth.sub).then( (owner) => {
                        unassign_boat(boat[0].owner.id, owner,req.params.id);
                    })
                } 
                // make sure there are no loads on the boat - load check
                load_check(req.params.id).then( (result) => {
                    if (result == false) {
                        delete_boat(req.params.id).then(res.status(204).json());
                    } 
                    else {
                        // update the boat object
                        for (let i = 0; i < Object.values(result[0]["loads"]).length; i++) {
                            get_load(result[0]["loads"][i].id).then((load_data) => {
                            deload(result[0]["loads"][i].id, load_data[0]);
                        })
                    }
                delete_boat(req.params.id).then(res.status(204).json())
                }
            })
            }
        })
        
    }
})

router.put('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).json({'Error' : E405});
});
router.delete('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).json({'Error' : E405});
});

router.patch('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).json({'Error' : E405});
});

router.get('/:boat_id/loads/:load_id', function (req, res){
    res.set('Accept', 'PATCH');
    res.status(405).json({'Error' : E405});
});


/* ------------- End Boats Controller Functions ------------- */

/* ----  ERROR HANDLING ----------- */

router.use(function (err, req, res, next) {
    if (err.name === "UnauthorizedError") {
      res.status(401).json({ 'Error' : 'INVALID TOKEN: Please renew token by logging in again. '});
    } else {
      next(err);
    }
  });

/* Export */
module.exports = router;