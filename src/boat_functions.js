const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const json2html = require('node-json2html');
const ds = require('./datastore');
const datastore = ds.datastore;
const BOAT = "Boats";
const LOAD = "Loads";
const OWNER = "Owners";

router.use(bodyParser.json());

/* ------------- Begin Boats Model Functions ------------- */
// list all boats:
function list_boats(){
    const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(ds.fromDatastore);
		});
}

function list_public_boats(){
    console.log("DEBUG - LIST PUBLIC BOATS()")
	const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(ds.fromDatastore).filter( item => item.public === true);
		});
}


function list_owners_boats(owner) {
    const q = datastore.createQuery(BOAT);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(ds.fromDatastore).filter( item => item.owner === owner );
		    });
}

function post_boat(boat_info) {
    var key = datastore.key(BOAT);
	const new_boat = boat_info;
	return datastore.save({"key":key, "data":new_boat}).then(() => {return key});
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
    console.log("DEBUG - GET_OWNER() - BOAT");
    return list_owners().then( (owners) => {
        console.log("owners: " + JSON.stringify(owners[0]))
        for (let i = 0; i < owners.length; i++) {
            console.log(owners[i])
            if (owners[i].owner == sub) {
                return owners[i];
            }
        }
    })
}

function list_owners() {
    console.log("DEBUG - LIST_OWNERS() - BOAT");
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

function uniqueName(id, name) {
    // check if the name exists in any other boat
    let unique = true;
    return boatlist = list_boats().then( (boats) => {
        for (let i = 0; i < boats.length; i++) {
            if ((boats[i].name === name) && !(id === boats[i].id)) {
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

function patch_boat(boat_id, req_data, boat_data) {
    const key = datastore.key([BOAT, parseInt(boat_id,10)]);
    // for (let i = 0; i < Object.values(req_data).length; i++) {
    boat_data["loads"] = req_data
        
    
    return datastore.save({"key":key, "data":boat_data});
};

function patch_attribute_check(boat_id, req_data, boat_data) {
    let valid = true;
    for (let i = 0; i < Object.keys(req_data).length; i++) {
        if (Object.keys(req_data)[i] in boat_data) {
            boat_data[Object.keys(req_data)[i]] = Object.values(req_data)[i];
        } if (!(Object.keys(req_data)[i] in boat_data)) {
            valid = false;
            break;
        }
    }
    return valid;
};

function put_boat(id, req_data, boat_data){
    console.log("req.data: " + JSON.stringify(req_data))
    const key = datastore.key([BOAT, parseInt(id,10)]);
    for (let i = 0; i < Object.keys(req_data).length; i++) {
        if (Object.keys(req_data)[i] in boat_data) {
            boat_data[Object.keys(req_data)[i]] = Object.values(req_data)[i];
        } 
        // else {
        //     boat_data[Object.keys(req_data)[i]] = Object.values(req_data)[i];
        // }
    }
    delete boat_data.id;
    console.log("boat_data: " + JSON.stringify(boat_data))
    return datastore.save({"key":key, "data":boat_data});
};

function load_check(id) {
    // given the id of the boat, check if the boat has loads
    // returns the full boat object if load exists?
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        // no entity/item found
        if (entity[0]["owner"] === undefined || entity[0]["owner"] === null) {
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
        boat[0].loads.push(load_id);
        return datastore.save({"key":b_key, "data":boat[0]});
    });
}

//  - adding carrier to load data
function assign_carrier(boat_id, load_id, boat_info, load_info) {
    const key = datastore.key([LOAD, parseInt(load_id,10)]);
    const carrier_info = {"id": boat_id, "name": boat_info.name}
    const load_data = { "volume": load_info.volume, "carrier": carrier_info, "item": load_info.item, "creation_date": load_info.creation_date}
    return datastore.save({"key": key, "data": load_data})
}

/* ------------- End Boats Model Functions ------------- */

/* Export */
module.exports = {
    list_boats:list_boats,
    get_boat:get_boat,
    get_load:get_load,
    assign_carrier:assign_carrier,
    assign_load:assign_load,
    deload:deload,
    load_check:load_check,
    patch_boat:patch_boat,
    put_boat:put_boat,
    patch_attribute_check:patch_attribute_check,
    htmlrender:htmlrender,
    uniqueName:uniqueName,
    validate:validate,
    list_owners_boats:list_owners_boats,
    post_boat:post_boat,
    list_public_boats:list_public_boats,
    get_owner:get_owner,
    delete_boat:delete_boat
};