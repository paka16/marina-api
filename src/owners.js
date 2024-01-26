const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
const BOAT = "Boats";
const OWNER = "Owners";

const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');
router.use(bodyParser.json());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const DOMAIN = process.env.DOMAIN;

// CONSTANTS
const USER401 = 'INVALID REQUEST: Unauthorized user.';
const MA400 = 'INVALID REQUEST: The request object is missing an attribute.';
const IA400 = 'INVALID REQUEST: An invalid attribute value detected.'
const EMPTY400 = 'INVALID REQUEST: Empty body is not allowed.';
const NE400 = 'INVALID REQUEST: This attribute does not exist for this boat_id.';
const E406 = "INVALID REQUEST: Not an Acceptable Media Type.";
const E415 = "INVALID REQUEST: The server accepts 'application/json' requests only.";
const E404 = "INVALID REQUEST: No boat with this boat_id exists." ;
const E405 = 'INVALID REQUEST: This method is not supported at this endpoint.';
const E403 = 'INVALID REQUEST: The request object’s name value is not unique.';
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

/* ------------- Begin Owner Model Functions ------------- */
// list of all owners - to search if owner exists: 
function list_owners(){
  const q = datastore.createQuery(OWNER);
  return datastore.runQuery(q).then( (entities) => {
    // auth doesn't matter
    return entities[0].map(ds.fromDatastore);    
  });
}

function get_owner(id) {
  const key = datastore.key([OWNER, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        // no entity/item found
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            // object/item exists
            return entity.map(ds.fromDatastore);
        }
    });
};

function list_owners_boats(owner) {
  const q = datastore.createQuery(BOAT);
return datastore.runQuery(q).then( (entities) => {
    return entities[0].map(ds.fromDatastore).filter( item => item.owner === owner);
      });
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

// unassigns the boat from the owner and vice versa
function unassign_owner(id, boat) {
  // unassign boat from owner
  const key = datastore.key([BOAT, parseInt(id,10)]);
  boat["owner"] = null;
  return datastore.save({"key":key, "data": boat})
  // unassign owner from boat
}

function unassign_boat(id, owner, boat_id) {
  // unassign boat from owner
  const key = datastore.key([OWNER, parseInt(id,10)]);
  let new_boats = [];
  for (let i = 0; i < owner.boats.length; i++) {
    if (owner.boats[i].id !== boat_id) {
      new_boats.push(owner.boats[i]);
    }
  }
  owner.boats = new_boats;
  return datastore.save({"key":key, "data": owner})
  // unassign owner from boat
}


// unassigns the boat from the owner and vice versa
function assign_owner(id, boat, owner_id, sub) {
  // unassign boat from owner
  const key = datastore.key([BOAT, parseInt(id,10)]);
  boat["owner"] = {"id": owner_id, "sub": sub};
  return datastore.save({"key":key, "data": boat})
  // unassign owner from boat
}

function assign_boat(id, owner, boat_id) {
  // unassign boat from owner
  const key = datastore.key([OWNER, parseInt(id,10)]);
  owner.boats.push({'id': boat_id})
  return datastore.save({"key":key, "data": owner})
}


function url_maker(req, object, base, id) {
  // if object has owner attribute 
  if ((object.owner) && object.owner !== null || object.owner !== undefined) {
      let owner_url = req.protocol + "://" + req.get("host") + '/owners' + '/' + object.id;
      object["self"] = owner_url;
  }
  if (object.boats !== null || object.boats !== undefined) {
    let boat_urls = [];
    for (let i = 0; i < object.boats.length; i++) {
      let boat_url = req.protocol + "://" + req.get("host") + '/boats' + '/' + object.boats[i].id;
      object["boats"][i]["self"] = boat_url;
      boat_urls.push({'id' : object.boats[i], 'self': boat_url})
  }
    object["boats"]["self"] = boat_urls;
  }
  // if loads
  if ((object.loads) && object.loads !== null || object.loads !== undefined) {
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

function owner_num(req) {
  var q = datastore.createQuery(OWNER);
  return datastore.runQuery(q).then( (entities) => {
      return entities[0].length;
  });
};
/* ------------- End Owner Model Functions ------------- */

/* ------------- Begin Owner Controller Functions ------------- */
router.get('/', (req, res) => {
  list_owners().then( (owners) => {
    let owner_infos = [];
    for (let i = 0; i < Object.keys(owners).length; i++) {
      let owner = url_maker(req, owners[i], "owners", owners[i].id);
      owner_infos.push(owner);
    }
    owner_num(req).then( (num) => {
      let returning_info = { 'total': num, "owners": owner_infos}
      res.status(200).json(returning_info);
    })
    
  })
});

router.get('/:id', checkJwt, (req, res) => {
  // auth - only show public boats.
  if (req.auth) {
    get_owner(req.params.id).then( (owner) => {
      // invalid owner
      if (owner[0] === undefined || owner[0] === null) {
        res.status(404).json({ 'Error' : 'INVALID REQUEST: This owner_id does not exist.' });
      }
      // valid owner id
      else {
        // if req.auth.sub !== owner
        if (req.auth.sub !== owner[0].sub) {
          res.status(403).json({ 'Error' : 'INVALID REQUEST: This verified user is not authorized for this request.'});
        }
        // correct owner and jwt
        else {
          list_owners_boats(req.params.id).then( (boats) => {
            for (let i = 0; i < owner[0]['boats'].length; i++) {
              let boat_url = req.protocol + "://" + req.get("host") + '/boats' + "/" + owner[0]['boats'][i].id;
              owner[0]["boats"][i]['self'] = boat_url;
            }
            var url = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + req.params.id;
            owner[0]["self"] = url;
            res.status(200).json(owner[0])
          })
        }
      }
    })
  }
  // no auth 
  else {
    res.status(401).json({ 'Error' : 'INVALID REQUEST: Unauthorized User.'})
  }
})

// assign a boat to an owner
router.patch('/:owner_id/boats/:boat_id', checkJwt, (req, res) => {
  if (!req.auth) {
    res.status(401).json({ 'Error' : USER401 });
  }
  else {
    get_owner(req.params.owner_id).then( (owner_obj) =>{
      if (owner_obj[0] === null || owner_obj[0] === undefined) {
        res.status(404).json({'Error' : 'INVALID REQUEST: This owner_id does not exist.' });
      }
      else {
        // token matches user_id
        if (owner_obj[0].sub !== req.auth.sub) {
          res.status(401).json({ 'Error' : 'INVALID REQUEST: JWT does not match the given user_id.'});
        }
        else {
          get_boat(req.params.boat_id).then( (boat_obj) => {
            if (boat_obj[0] === null || boat_obj[0] === undefined) {
              res.status(404).json({ 'Error' : E404 })
            }
            // boat has an owner
            else if (boat_obj[0].owner !== null) {
              res.status(403).json({ 'Error' : "INVALID REQUEST: This boat already has an owner."});
            }
            else {
              assign_boat(req.params.owner_id, owner_obj[0], req.params.boat_id)
              .then(assign_owner(req.params.boat_id, boat_obj[0], req.params.owner_id, req.auth.sub))
              .then(res.status(204).json())
            }
          })
        }
      }
    })
  }
})

// delete boat from an owner
router.delete('/:owner_id/boats/:boat_id', checkJwt, (req, res) => {
  // check auth
  if (!req.auth) {
    res.status(401).json({ 'Error' : USER401 });
  }
  else {
    // if the owner owns this boat
    get_owner(req.params.owner_id).then( (owner_obj) => {
      if (owner_obj[0] === null || owner_obj[0] === undefined) {
        res.status(404).json({ 'Error' : 'INVALID REQUEST: Non-existent owner_id given.' });
      }
      else if (owner_obj[0] !== null || owner_obj !== undefined) {
        if (owner_obj[0].sub === req.auth.sub) {
          // delete boat from owner
          // delete owner from boat
          get_boat(req.params.boat_id).then( (boat_obj) => {
            // if boat object exists
            if (boat_obj[0] === undefined || boat_obj[0] === null) {
              res.status(404).json({ 'Error' : E404 });
                
            } 
            else {
              if (boat_obj[0].owner === null) {
                res.status(403).json({ 'Error' : 'INVALID REQUEST: This boat has no owner.'});
              }
              else if (boat_obj[0].owner.sub === req.auth.sub) {
                unassign_boat(req.params.owner_id, owner_obj[0], req.params.boat_id)
                .then(unassign_owner(req.params.boat_id, boat_obj[0], req.auth.sub))
                .then(res.status(204).json());              
              }
              else {
                res.status(401).json({ 'Error' : WO401});
              }
            }
          })
        }
        // this owner doesn't own this boat
        else {
          res.status(401).json({ 'Error' : 'INVALID REQUEST: This authorized user has no relation with this boat_id.'});
        }
      }
      else {
        res.status(403).json({ 'Error' : 'INVALID REQUEST: This boat has no owner.'})
      }
    })
  }
  
})

/* ------------- End Owner Controller Functions ------------- */



router.use(function (err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    res.status(401).json({ 'Error' : 'INVALID TOKEN: Please renew token by logging in again. '});
  } else {
    next(err);
  }
});

/* Export */
module.exports = router;
