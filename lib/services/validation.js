import { WSAVERNOTSUPPORTED } from "constants";

'use strict';

function lower(value) {
  return value.toLowerCase();
}

function upper(value) {
  return value.toUpperCase();
}

function ucfirst(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function lcfirst(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}



module.exports = {
  lower,
  upper,
  ucfirct,
  lcfirst
};
