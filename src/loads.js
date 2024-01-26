const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;

const BOAT = "Boats";
const LOAD = "Loads";
const OWNER = "Owners";

router.use(bodyParser.json());


// CONSTANTS
const MA400 = 'INVALID REQUEST: The request object is missing an attribute.';
const EMPTY400 = 'INVALID REQUEST: Empty body is not allowed.';
const E401USER = 'INVALID REQUEST: Unauthorized User.';
const E406 = "INVALID REQUEST: Not an Acceptable Media Type.";
const E415 = "INVALID REQUEST: The server accepts 'application/json' requests only."
const IA400 = 'INVALID REQUEST: An invalid attribute value detected.'
const NE400 = 'INVALID REQUEST: This attribute does not exist for this boat_id.';
const E404 = "INVALID REQUEST: No load with this load_id exists." ;
const E405 = 'INVALID REQUEST: This method is not supported at this endpoint.';
const E403 = "INVALID REQUEST: The request object does not have a unique name value.";
const E403LOADED = "INVALID REQUEST: The load is already loaded on another boat.";


/* ------------- Begin Load Model Functions ------------- */
// list all loads
function list_loads(req){
    var q = datastore.createQuery(LOAD).limit(5);
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        let decoded = decodeURIComponent(req.query.cursor);
        q = q.start(decoded);
    }
	return datastore.runQuery(q).then( (entities) => {
        results.loads = entities[0].map(ds.fromDatastore);
        if ((entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS )) {
            let encoded = encodeURIComponent(entities[1].endCursor);
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encoded;
        }  // the last page of results shouldn't have a next button
		return results;
	});
}

function load_num(req) {
    var q = datastore.createQuery(LOAD);
    return datastore.runQuery(q).then( (entities) => {
        return entities[0].length;
    });
};

function validate(reqInputs, reqInputTypes) {
    let test = true;
    for (let i = 0; i < reqInputTypes.length; i++) {
        if ((reqInputs[i][0] === 'req.body.item') && (reqInputs[i][1] !== null) && (reqInputs[i][1] !== undefined)){
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
        if ((reqInputs[i][0] === 'req.body.origin') && (reqInputs[i][1] !== null) && (reqInputs[i][1] !== undefined)){
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

        if ((reqInputs[i][0] === 'req.body.volume')  && (reqInputs[i][1] !== null) && (reqInputs[i][1] !== undefined)){
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
        
    } return test;
}

// get a single load with load_id
function get_load(req, id) {
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


// create a new load item
function post_load(volume, item, origin) {
    /* for post, create the initial item and then in the controller, patch it? */
    // key == datastore's entity's key
    // find the key of the kind == LOAD
    const key = datastore.key(LOAD);
    var valid = false; 
    
    if (volume !== null && item !== null) {
        return datastore.save({ "key": key, "data": { "volume": volume, "carrier": null, "item": item, "origin": origin } })
            .then(() => { return key });
    } else {
        return valid;
    }
}

function put_load(id, req_data, load_data){
    const key = datastore.key([LOAD, parseInt(id,10)]);
    for (let i = 0; i < Object.keys(req_data).length; i++) {
        if (Object.keys(req_data)[i] in load_data) {
            load_data[Object.keys(req_data)[i]] = Object.values(req_data)[i];
        } 
    }
    return datastore.save({"key":key, "data":load_data});
};

// DELETE  a load 
function delete_load(id){
    const key = datastore.key([LOAD, parseInt(id,10)]);
    return datastore.delete(key);
}

function delete_load_from_boat(load_id, boat_id, boat_item) {
    const key = datastore.key([BOAT, parseInt(boat_id,10)]);
    let new_load = [];
    for (let i = 0; i < boat_item[0].loads.length; i++) {
        
        if (load_id !== boat_item[0].loads[i]) {
            new_load.push(boat_item[0].loads[i]);
        }
    }
    
    const boat_data = { "name": boat_item[0].name, "type": boat_item[0].type, "length": boat_item[0].length, "loads": new_load};
    return datastore.save({"key": key, "data": boat_data})

}

// get boat
function get_boat(req, id) {
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

function patch_load(id, req_data, load_data) {
    const key = datastore.key([LOAD, parseInt(id,10)]);
    for (let i = 0; i < Object.keys(req_data).length; i++) {
        if (Object.keys(req_data)[i] in load_data) {
         load_data[Object.keys(req_data)[i]] = Object.values(req_data)[i];
        }
    }
    return datastore.save({"key":key, "data":load_data});
}



function url_maker(req, object, base, id) {
    if (object.carrier !== null && object.carrier !== undefined) {
      let boat_url = req.protocol + "://" + req.get("host") + '/boats' + '/' + object.carrier.id;
      object["carrier"]["self"] = boat_url;
    }

    let url = req.protocol + "://" + req.get("host") + '/' + base + '/' + id;
    object["self"] = url;
    return object
  }
/* ------------- End Load Model Functions ------------- */

/* ------------- Begin Load Controller Functions ------------- */
// GET all loads
router.get('/', function (req, res) {
    list_loads(req)
        .then((loads) => {
            // 'loads' -> the list of all boat items.
            let load_info = []
            
            for (let i = 0; i < loads["loads"].length; i++) {
                let load_url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + loads["loads"][i].id;
                if (loads["loads"][i].carrier === null || loads["loads"][i].carrier === undefined) {
                    let info = {"id": loads["loads"][i].id, "volume": loads["loads"][i].volume, "carrier": null, "item": loads["loads"][i].item, "origin": loads["loads"][i].origin, "self": load_url}
                    load_info.push(info)
                } else {
                    let boat_url = req.protocol + "://" + req.get("host") + "/boats/" + loads["loads"][i].carrier.id
                    let carrier_info = {"id": loads["loads"][i].carrier.id, "name": loads["loads"][i].carrier.name, "self": boat_url}
                    let info = {"id": loads["loads"][i].id, "volume": loads["loads"][i].volume, "carrier": carrier_info, "item": loads["loads"][i].item, "origin": loads["loads"][i].origin, "self": load_url}
                    load_info.push(info)
                }
                
            }
            load_num(req).then( (num) => {
                let returning_info = {'total': num, "loads": load_info, "next": loads["next"]}
                res.status(200).json(returning_info);
            })
            
            // sending a 200 res status with the boat list in json format
        });
});

// GET a single load
router.get('/:id', function (req, res) {
    get_load(req, req.params.id)
        .then((load) => {
            try {
                if (load[0] === undefined || load[0] === null) {
                    throw "INVALID REQUEST: No load with this load_id exists.";
                } else {
                    // create the self:
                    var url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + load[0].id;
                    // get carrier info
                    if (load[0].carrier !== null) {
                        const carrier_info = {"id": load[0].carrier["id"], "name": load[0].carrier.name, "self": req.protocol + "://" + req.get("host") + "/boats/" + load[0].carrier["id"]};
                        var info = {"id": load[0].id, "volume": load[0].volume, "carrier": carrier_info, "item": load[0].item, "origin": load[0].origin, "self": url }
                        res.status(200).json(info);
                    } else {
                        var info = {"id": load[0].id, "volume": load[0].volume, "carrier": null, "item": load[0].item, "origin": load[0].origin, "self": url }
                        res.status(200).json(info);
                    }
                    
                }
            } catch (err) {
                res.status(404).json({ 'Error': err});
            } 
        });
});

// CREATE a single load

router.post('/', function (req, res) {
    const accepts = req.accepts(['application/json']);
    // if the request wasn't sent with application/json
    if(req.get('content-type') !== 'application/json'){
        return res.status(415).json({'Error': E415})
    } 
    if (accepts !== req.get('Accept')) {
        return res.status(406).json({'Error': E406})
    } 
    else if (req.body.volume !== undefined && req.body.origin !== undefined && req.body.item !== undefined) {
        post_load(req.body.volume, req.body.item, req.body.origin)
            .then(key => {
                // key returned is the entity's key
                var url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + key.id;
                res.status(201).json({"id": key.id, "volume": req.body.volume, "carrier": null, "item": req.body.item, "origin": req.body.origin, "self": url});
            })
    } else {
        res.status(400).json({'Error' : MA400});
    }
    }
);


router.patch('/:id', function (req, res) {
    const accepts = req.accepts(['application/json']);
    if(req.get('content-type') !== 'application/json'){
        res.status(415).json({'Error': E415});
    } else if (!accepts) {
        res.status(406).json({'Error': E406})
    }  
    else if (typeof(req.body.id) !== 'undefined' || req.body.id !== undefined) {
        if (req.body.id !== req.params.id) {
            res.status(400).json({'Error' : 'INVALID REQUEST: The id cannot be edited.'})
        }
    } else if (req.body === null || req.body === undefined || Object.keys(req.body).length === 0) {
        res.status(400).json({'Error': EMPTY400 });
    } 
    else {
        reqInputs = [["req.body.item", req.body.item], ["req.body.volume", req.body.volume], ["req.body.origin", req.body.origin]];
        reqInputTypes = ["string", "float", "string"]
        const validation = validate(reqInputs, reqInputTypes);
        if (validation === false) {
            res.status(400).json({ 'Error': IA400 });
        }
        else {
            get_load(req, req.params.id)
            .then( (load) => {
                if (load[0] === undefined || load[0] === null) {
                    // check for unique name
                    res.status(404).json({'Error' : E404});
                } else {
                    // valid load id
                    if ((req.body.item !== undefined || req.body.item !== null) && (req.body.volume !== undefined || req.body.volume !== null) && (req.body.origin !== undefined || req.body.origin !== null)) {
                        // if boat isn't updating name
                        patch_load(req.params.id, req.body, load[0])
                            .then( (result) => {
                            let object = url_maker(req, load[0], "loads", req.params.id);
                            res.status(201).json(object);                        
                }) 
                        }
                    }
            })
        }
    }
})

router.put('/:id', function (req, res){
    const accepts = req.accepts(['application/json']);
    if(req.get('content-type') !== 'application/json'){
        res.status(415).json({'Error': E415});
    } else if (!accepts) {
        res.status(406).json({'Error': E406})
    }  
    else if (typeof(req.body.id) !== 'undefined' || req.body.id !== undefined) {
        if (req.body.id !== req.params.id) {
            res.status(400).json({'Error' : 'INVALID REQUEST: The id cannot be edited.'})
        }
    } else if (req.body === null || req.body === undefined || Object.keys(req.body).length === 0) {
        res.status(400).json({'Error': EMPTY400 });
    } else if ((req.body.item === null || req.body.item === undefined) || (req.body.volume === null || req.body.volume === undefined) || (req.body.origin === null || req.body.origin === undefined)) {
        res.status(400).json({'Error': MA400})
    }
    else {
        // check body attributes validity
        // validate the incoming attributes to be what's allowed:
        reqInputs = [["req.body.item", req.body.item], ["req.body.volume", req.body.volume], ["req.body.origin", req.body.origin]];
        reqInputTypes = ["string", "float", "date"]
        const validation = validate(reqInputs, reqInputTypes);
        if (validation === false) {
            res.status(400).json({ 'Error': IA400 });
        } else {
        get_load(req, req.params.id)
            .then( (load) => {
                if (load[0] === undefined || load[0] === null) {
                    // check for unique name
                    res.status(404).json({'Error' : E404});
                } else {
                    // valid boat id
                    if ((req.body.item !== undefined || req.body.item !== null) && (req.body.volume !== undefined || req.body.volume !== null) && (req.body.origin !== undefined || req.body.origin !== null)) {
                        // if boat isn't updating name
                        put_load(req.params.id, req.body, load[0])
                            .then( (result) => {
                            let object = url_maker(req, load[0], "loads", req.params.id);
                            res.status(201).json(object);                         
                }) 
                        }
                    }
            })
        }   
    }
});

router.delete('/:load_id', function(req, res){
    get_load(req, req.params.load_id).then( (load) => {
        // if the load id doesn't exist
        if (load[0] === undefined || load[0] === null) {
            res.status(404).json({ 'Error' : E404});
        } else {
           // check if load exists on a carrier
            if (load[0].carrier === null || load[0].carrier === undefined) {
                delete_load(req.params.load_id).then(res.status(204).json())
                
                
            } else {
                    get_boat(req, load[0].carrier.id).then( (boat) => {
                        if (boat[0] === undefined || boat[0] === null) {
                            delete_load(req.params.load_id).then(res.status(204).json());
                        }
                        else {
                            if (boat[0].owner) {
                                delete_load_from_boat(req.params.load_id, load[0].carrier.id, boat)
                                .then(delete_load(req.params.load_id).then(res.status(204).json()));
                            }
                            else {
                                delete_load(req.params.load_id).then(res.status(204).json());
                            }
                        }
                })
            }
        }
    })
    
});

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

/* ------------- End Load Controller Functions --------------- */

/* Export */
module.exports = router;