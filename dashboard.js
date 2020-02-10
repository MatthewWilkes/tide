var connection = null;

(function() {
    'use strict';
  
    function on_error(error_data) {
      alert(error_data);
    };
    
    document.addEventListener('DOMContentLoaded', event => {
        let connectButton = document.querySelector('#connect');
        let runButton = document.querySelector('#run');
        let intButton = document.querySelector('#interrupt');
        let startButton = document.querySelector('#remote');
        let installButton = document.querySelector('#install');
        let saveButton = document.querySelector('#save');
        let loadButton = document.querySelector('#load');
        let lsButton = document.querySelector('#ls');
    
        
      connectButton.addEventListener('click', function() {
        // get USB  port
        badge.connect().then((conn) => { 
          // Open interface
          conn.onError = on_error;
          conn.connect();
          return conn;
        }).then((active) => {
          // Mark as ready
            connection = active;
        }).catch(on_error);
      });


      runButton.addEventListener('click', function() {
        //t.io.println('Running app');
        var cmd = {"cmd": "exec_app", app: document.getElementById("appname").value};
        connection.send(cmd).then((e) => { console.log(e) });
      });
  
      intButton.addEventListener('click', function() {
        //t.io.println('^C');
        //t.io.sendString("\x03");
      });
  
      startButton.addEventListener('click', function() {
        //t.io.sendString("\x03");
        
        var date = new Date();
        var curDate = null;
        do { curDate = new Date(); }
        while(curDate-date < 2000);
    
        //t.io.sendString("import system; system.start('remote_control')\r\n");
      });
      
      saveButton.addEventListener('click', function() {
        //t.io.println('Saving file');
        var cmd = {"cmd": "write", path: document.getElementById("filename").value, data: document.getElementById("filecontents").value};
        $(saveButton).attr("disabled", true);
        connection.send(cmd).then((e) => { 
          $(saveButton).attr("disabled", false);
        }).catch((e) => {
          alert(e);
          $(saveButton).attr("disabled", false);
        });
      });
  
      loadButton.addEventListener('click', function() {
        var cmd = {"cmd": "read", path: document.getElementById("filename").value};
        connection.send(cmd).then((contents) => { document.getElementById("filecontents").value = contents.result });
      });
  
      lsButton.addEventListener('click', function() {
        
        async function getTree(path) {
          var files = [];
          try {
            var items = await connection.send({"cmd": "lsdir", path: path});
          } catch (e) {
            if (e.ok == false) {
              return null;
            }
            throw e;
          }
          for (var i = 0; i < items.result.length; i++) {
            let filename = items.result[i];
            let subpath = path + "/" + filename;
            self = await getTree(subpath);
            files = files.concat([{"filename": filename, "children": self}])
          };
          return files;
        }
        
       
        var drawItems = (items, root) => {
          for (var i = 0; i < items.length; i++) {
            let item = items[i];
            var container;
            if (item.children == null) {
              container = $("<li>"+item.filename+"</li>")[0];
              root.appendChild(container);
            } else {
              container = $("<ul><li><strong>"+item.filename+"</strong></li>'</ul>")[0];
              drawItems(item.children, container);
              root.appendChild(container);
            }
          };
        };
        
        getTree("/").then(tree => {
          console.log(tree);
          drawItems(tree, document.getElementById("files"));
        });
    });
    
  });
    
})();
