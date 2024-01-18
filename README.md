# marina-api
A  REST API program with documentation and testing (via postman).

## INFORMATION
CLOUD APPLICATION DEVELOPMENT - An implementation of a REST API with proper resource-based URLs, pagination, status codes, authorization (Auth0) deployed on Google Cloud Platform. 
<br>
* GCP's Datastore is used to store the data.

## TECHNOLOGIES
* Node.js - Javascript
* Google Cloud Platform - Google App Engine
* Postman - Testing
  
## HOW-TO
1. Get the necessary credentials:
2. run the command:
```npm start```
<br>


## DOCUMENTATION
Breakdown:
<br>
3 user entities:
* User
* Boat
* Load

<br>
Relationship:
<br>

* A user can have many boats, but a boat may only have one user (one-to-many).
* A load can only be on a single boat, but a boat may have multiple loads (one-to-many).
* All user related resources will be protected with Authorization - JWT-based. 

Specifics are in the file above.
Link:

<br>

GET:
  * ```GET /user_id ```
  * protected: returns the user and their boats.
  * unprotected: returns an error.

  * ```GET /users```
  * protected:
  * unprotected:

  * ```GET /boats```
  * protected:
  * unprotected:

  * ```GET /boat_id```
  * protected:
  * unprotected:

  * ```GET /loads``` - Not Protected

  * ```GET /load_id``` - Not Protected

<br>

POST:

<br>

PATCH:

<br>

PUT:

<br>

DELETE: 
