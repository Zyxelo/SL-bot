/**
 * Created by victorode on 2017-06-04.
 */
const request = require('request');
const config = require('config');
const groupBy = require('lodash.groupby');
const mapValues = require('lodash.mapvalues');

const transportationtypes = ['Metros', 'Buses', 'Trains', 'Trams', 'Ships'];

// function for finding a stationID by name



const findStationID = function(query, callback) {
  let format = 'Json';
  let key = config.get('API-keys.SL-P');
  let stationsOnly = 'True';
  let maxResults = '4';
  let getAdress =  'http://api.sl.se/api2/typeahead.' + format + '?key=' + key +
    '&searchstring=' + query + '&stationsonly=' + stationsOnly + '&maxresults=' + maxResults;


  request(getAdress, function (error, response, body) {
    console.log('error:', error); // Print the error if one occurred
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    //console.log('body:', JSON.parse(body)); // Print the HTML for the Google homepage.
    let results = JSON.parse(body).ResponseData;

    //let topResult = results[0].SiteId;

    //console.log(topResult);
    callback(results);
  });
};


const getInfoStation = function(siteID, callback) {
  let format = "Json";
  let timeWindow = '30';
  let key = config.get('API-keys.SL-Real');
  let getAdress = 'http://api.sl.se/api2/realtimedeparturesV4.' + format + '?key=' + key +
    '&siteid=' + siteID + '&timewindow=' + timeWindow;


  request(getAdress, function (error, response, body) {
    console.log('error:', error); // Print the error if one occurred
    console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    //console.log('body:', JSON.parse(body).ResponseData.Metros); // Print the HTML for the Google homepage.

    //console.log(JSON.parse(body).ResponseData);
    let responseData = JSON.parse(body).ResponseData;

    Object.keys(responseData).forEach(function(transportationType) {
      if (responseData[transportationType].length > 0 && transportationtypes.includes(transportationType)) {
        let grouped = groupBy(responseData[transportationType], departures => departures.LineNumber);
        Object.keys(grouped).forEach(function(key) {
          //console.log(key);
          let groupedLine = groupBy(grouped[key], departures => departures.Destination);

          Object.keys(groupedLine).forEach(function(destination) {
            let times = [];

            Object.keys(groupedLine[destination]).forEach(function(destinationObjectKey){
              times = [...times, groupedLine[destination][destinationObjectKey].DisplayTime];
            });
            groupedLine[destination] = times;
          });
          grouped[key] = groupedLine;
        });
        responseData[transportationType] = grouped;
      } else {
        delete responseData[transportationType];
      }
    });

    //console.log(responseData);
    callback(responseData);
  });
};


const getInfoByName = function(query, callback) {
  findStationID(query, function(results) {
    console.log(results);
    let topResult = results[0].SiteId;
    getInfoStation(topResult, callback);
  });

}




module.exports.findStationID = findStationID;
module.exports.getInfoStation = getInfoStation;
module.exports.getInfoByName = getInfoByName;

findStationID('Solna', (hej) => console.log(hej));
//getInfoStation('9192', (hej) => console.log(hej) );