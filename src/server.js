const express = require('express');
const app = express();
const ds = require('./datastore');
const datastore = ds.datastore;
const { jwtDecode } = require('jwt-decode'); 

// const { auth, requiresAuth } = require('express-openid-connect');
// this is to view the user's information after logging in.

const bodyParser = require('body-parser');
const request = require('request');

// to access owner model functions
const OWNER = "Owners"

require('dotenv').config()

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const DOMAIN = process.env.DOMAIN;
const USER_URL = process.env.USER_URL;


app.use(bodyParser.json());
app.enable('trust proxy');


// ################ LOGIN #######################################
// SOURCES: 
// Auth0 Set Up for Node.js
// https://auth0.com/docs/quickstart/webapp/express#integrate-auth0
// ########################################################################

// list of all owners - to search if owner exists: 
function list_owners(){
    const q = datastore.createQuery(OWNER);
    return datastore.runQuery(q).then( (entities) => {
      return entities[0].map(ds.fromDatastore);
    });
}
  // FUNCTION FOR ADDING OWNER / POST OWNER
  // create a new owner item with first signin.
function post_owner(nickname, sub, email) {
/* for post, create the initial item and then in the controller, patch it? */
// key == datastore's entity's key
    const key = datastore.key(OWNER);
    var not_valid = false; 
    
    if (sub !== null) {
        return datastore.save({ "key": key, "data": { "sub": sub, "nickname": nickname, "email": email, "boats": [] } })
            .then(() => { return key });
    } else {
        return not_valid;
    }
}

app.get('/', (req, res, next) => {
    let url = 'https://' + DOMAIN + "/authorize?response_type=code&client_id=" + CLIENT_ID + "&redirect_uri=" + USER_URL + "&scope=openid%20profile";
    res.redirect(url);   
});

app.get('/user_info', (req, res) => {
    var options = { method: 'POST',
        url: `https://${DOMAIN}/oauth/token`,
        headers: { 'content-type': 'application/json' },
        body:
            {  grant_type: 'authorization_code',
               client_id: CLIENT_ID,
               client_secret: CLIENT_SECRET, 
               code: req.query.code,
               redirect_uri: USER_URL},
        json: true };
    request(options, (error, response, body) => {
        if (error){
            res.status(500).send(error);
            } else {
                let decoded_token = jwtDecode(body.id_token);
                let user = decoded_token.sub;
                let nickname = decoded_token.nickname;
                let email = decoded_token.name;
                
                // check if owner exists in datastore
                list_owners().then( (owners) => {
                    // if owner list is returned
                    let found_user = false;
                    if (owners !== null || owners !== false || owners !== undefined) {
                        // if owner exists
                        for (let i = 0; i < owners.length; i++) {
                            if (owners[i]["sub"] === user) {
                                found_user = true;
                            }
                        }
                        // if new user
                        if (found_user === false) {
                            post_owner(nickname, user, email).then(res.status(200).json({'unique_id': user, 'JWT': body.id_token}))
                        }
                        // returning user
                        else {
                            res.status(200).json({'unique_id': user, 'JWT': body.id_token});
                        }
                    }
                })      
        }
    });
})

// generating a token for a logged in user - postman testing purposes.
app.post('/', function(req, res){
    const username = req.body.username;
    const password = req.body.password;
    var options = { method: 'POST',
            url: `https://${DOMAIN}/oauth/token`,
            headers: { 'content-type': 'application/json' },
            body:
             { grant_type: 'password',
               username: username,
               password: password,
               client_id: CLIENT_ID,
               client_secret: CLIENT_SECRET },
            json: true };
    request(options, (error, response, body) => {
        if (error){
            res.status(500).send(error);
        } else {
            res.send(body);
        }
    });

});


app.use('/', require('./index'));

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});