# CHANGELOG
## 0.21.0 (13 June 2018)
+ If no config is passed, the service layer calls admin.initializeApp()
  with no params assuming we're being run from inside the Google Cloud
  Platform.
## 0.20.0 (13 June 2018)
+ publicApiKey from customers perspective uses aid{28}key{6}
+ update unit tests

## 0.19.0 (12 June 2018)
+ Payloads use aid, pid and lid short forms
+ Error messages return as a JSON string

## 0.18.3 (2 June 2018)
+ Fix broken versions in package.json (tag and unit tests), lib/app.js
## 0.18.2 (2 June 2018)
+ Fix broken version in package.json

## 0.18.1 (2 June 2018)
+ Fix broken semveg tag for app

## 0.18.0 (2 June 2018)
+ Use nested sub-collections account->projects->leads instead of flat root level collections

## 0.17.0 (2 June 2018)
+ Remove HTTP HEAD requests as Google Cloud Functions do not support this

## 0.16.1 (1 June 2018)
+ Fix mismatched APP_VERSION string

## 0.16.0 (1 June 2018)
+ Uses x-capturoo-timing and x-capturoo-version headers

## 0.15.2 (1 June 2018)
+ Move root level leadId property to system.leadId for GetLead and QueryLeads operations
+ Unit test improvements to catch missing keys in the lead system object
+ Fix bug with server reporting version number

## 0.15.1 (1 June 2018)
+ .npmignore file to make smaller pack file

## 0.15.0 (1 June 2018)
+ DeleteLead operation
+ Improved unit testing

## 0.14.0 (31 May 2018)
+ Pagination with startAt
+ Improved unit testing

## 0.13.0 (31 May 2018)
+ Change leads to use { system, data, lead}
+ Get leads with ordering and direction
+ Get lead by lead ID

## 0.12.0 (31 May 2018)
+ Rename addLead to createLead
+ Adds additional code coverage

## 0.11.2 (30 May 2018)
+ Fixes deletion of project including leads

## 0.11.1 (30 May 2018)
+ Fixes broken package tag

## 0.11.0 (30 May 2018)
+ improve integration test to optionally display JWT
+ x-timing headers for firestore

## 0.10.0 (30 May 2018)
+ Firebase authentication and token verification
+ Batch delete (DELETE /projects/:projectId returns 204)
+ Adds upertest integration testing

## 0.9.1 (28 May 2018)
+ Fix package version tag
+ Add repository line to package.json

## 0.9.0 (28 May 2018)
+ Transactional lead counter
+ Helper code script to count leads in a collection

## 0.8.0 (25 May 2018)
+ Order and limit on getAllLeads

## 0.7.0 (24 May 2018)
+ Local server config is moved to config.json to include credentials and database properties

## 0.6.0 (14 May 2018)
+ Change project name (typo)

## 0.5.0 (14 May 2018)
+ Change package.json to rename project as the repository has been renamed
+ Dependencies supertest 3.0.0 -> 3.1.0

## 0.4.0 (8 May 2018)
+ HTTP POST /projects

## 0.3.0 (1 May 2018)
+ Removes hardcoded credentials and accepts them as parameter

## 0.2.3 (1 May 2018)
+ Remove console.log statements

## 0.2.2 (1 May 2018)
+ Release with correct package.json

## 0.2.1 (30 April 2018)
+ Git ignore .tgz files from npm pack

## 0.2.0 (30 April 2018)
+ Adds new middleware for private key auth
+ HTTP GET /account
+ HTTP GET /projects
+ HTTP GET /projects/:projectId/leads

## 0.1.0 (30 April 2018)
+ Lead Capture API POST /leads
