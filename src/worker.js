export default () => {
  var data = "";


  onmessage = function(event) {
    var msg_data = event.data;
    let textDecoder = new TextDecoder();
    if (event.data == "") {
      return;
    }
    var response = textDecoder.decode(msg_data);
    //console.log("Received " + response);

    data += response;
    var split = data.split(/\n/);
    data = split.pop();
    split.forEach((response) => {
        try {
          var parsed = JSON.parse(response);
          if (parsed.hasOwnProperty("hex")) {
            parsed["bytes"] = new Uint8Array(parsed["hex"]);
            delete parsed["hex"];
          }
          if (parsed.hasOwnProperty("command") && parsed["command"].hasOwnProperty("id")) {
              var id = parsed["command"]["id"];
              console.log("Completed " + JSON.stringify(parsed["command"]) + " in " + parsed["elapsed"] + "seconds");
              postMessage(parsed);
          }
        } catch (e) {
            
        }
    });
    
  }

};