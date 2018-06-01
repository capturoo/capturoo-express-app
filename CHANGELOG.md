# CHANGELOG

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
