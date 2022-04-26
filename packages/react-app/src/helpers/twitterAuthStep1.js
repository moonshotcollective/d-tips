import axios from "axios";
export default function twitterAuthStep1(callback) {
  var config = {
    method: "get",
    url: "http://localhost:4000/",
  };

  axios(config)
    .then(function (response) {
      console.log(response.data);
      callback(response.data);
    })
    .catch(function (error) {
      console.log(error);
    });

}
