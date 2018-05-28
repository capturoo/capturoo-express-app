# CHANGELOG

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
