'use strict';

export let badge = {};

badge.connect = function() {
  const products = [
    { 'vendorId': 0x10c4, 'productId': 0xea60 },
  ];
  return navigator.usb.requestDevice({ 'filters': products }).then(
    device => new badge.Connection(device)
  );
}

badge.Connection = function(device) {
  this.device_ = device;
  this.data = "";
  this.responses = [];
  this.commands = {};
  this.results = {};
  this.last_id = 0;
};

badge.Connection.prototype.get_id = function() {
    this.last_id += 1;
    return this.last_id;
}

badge.Connection.prototype.onReceive = function(data) {
    let textDecoder = new TextDecoder();
    var response = textDecoder.decode(data);
    //console.log("Received " + response);

    this.data += response;
    var split = this.data.split(/\n/);
    this.data = split.pop();
    this.responses = this.responses.concat(split);
    this.responses.forEach((response) => {
        try {
          var parsed = JSON.parse(response);
          if (parsed.hasOwnProperty("hex")) {
            parsed["bytes"] = new Uint8Array(parsed["hex"]);
            //parsed["result"] = textDecoder.decode(parsed["bytes"]);
            delete parsed["hex"];
          }
          if (parsed.hasOwnProperty("command") && parsed["command"].hasOwnProperty("id")) {
              var id = parsed["command"]["id"];
              this.results[id] = parsed;
          }
        } catch (e) {
            
        }
    });
    this.responses = [];
}

badge.Connection.prototype.connect = function() {
  let readLoop = () => {
    this.device_.transferIn(this.endpointIn_, 256).then(result => {
      //console.log(result);
      this.onReceive(result.data);
      readLoop();
    }, error => {
      this.onError(error);
    });
  };

  
  return this.device_.open()
  .then(() => {
    if (this.device_.configuration === null) {
      return this.device_.selectConfiguration(1);
    }
  })
  .then(() => {
    var configurationInterfaces = this.device_.configuration.interfaces;
    configurationInterfaces.forEach(element => {
      element.alternates.forEach(elementalt => {
        if (elementalt.interfaceClass==0xff) {
          this.interfaceNumber_ = element.interfaceNumber;
          elementalt.endpoints.forEach(elementendpoint => {
            if (elementendpoint.direction == "out") {
              this.endpointOut_ = elementendpoint.endpointNumber;
            }
            if (elementendpoint.direction=="in") {
              this.endpointIn_ =elementendpoint.endpointNumber;
            }
          })
        }
      })
    })
  })
  .then(() => this.device_.claimInterface(this.interfaceNumber_))
  .then(() => this.device_.selectAlternateInterface(this.interfaceNumber_, 0))
  .then(() => this.device_.controlTransferOut({
    'requestType': 'vendor',
    'recipient': 'interface',
    'request': 0x1E,
    'value': 0x00020000,
    'index': 0}, new Uint8Array([0xb8, 0xc2, 0x01, 0x00])
  ))

  .then(() => this.device_.controlTransferOut({
    'requestType': 'vendor',
    'recipient': 'interface',
    'request': 0x00,
    'value': 0x01,
    'index': 0}))


  .then(() => {
    readLoop();
  });
};


badge.Connection.prototype.disconnect = function() {
  return this.device_.controlTransferOut({
          'requestType': 'class',
          'recipient': 'interface',
          'request': 0x00,
          'value': 0x00,
          'index': 0})
      .then(() => this.device_.close());
};

badge.Connection.prototype.getFile = async function(data) {
  var path = data.path;
  var final = [];
  var position = 0;
  
  while (1) {
    console.log("Getting bytes from " + position);
    data = await this.send({"cmd": "read_bin", "path": path, "offset": position});
    let old_data = final;
    let new_data = data.bytes;
    final.push(new_data);
    position += new_data.length;
    console.log(new_data.length);
    if (new_data.length < 512) {
      break;
    }
  }
  let textDecoder = new TextDecoder();
  var result = "";
  for (var i = 0; i < final.length; i++) {
    result += textDecoder.decode(final[i]);
  }

  return {"bytes": final, "result": result, "cmd": data};
}

badge.Connection.prototype.send = function(data) {
  return new Promise((resolve, reject) => {
      var id = this.get_id();
      data.id = id;
      this.commands[id] = data;
      var n = 500;
      let val = JSON.stringify(data)+"\r\n";
      let textEncoder = new TextEncoder();
      //if (!this.results.hasOwnProperty(id)) {
        //console.log("Sending " + val)
        var sent = this.device_.transferOut(this.endpointOut_, textEncoder.encode(val));
      //}
      var ok = (n) => {
          if (this.results.hasOwnProperty(id)) {
              let response = this.results[id];
              delete this.results[id];
              if (response.ok) {
                  resolve(response)
              } else {
                  reject(response);
              }
          }
          if (n > 0) {
              window.setTimeout(ok, 100, n-1);
          } else {
              reject("timeout "+val);
          }
      };
      ok(10);
  });
};
