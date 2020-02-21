import React from 'react';
import logo from './logo.svg';
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/ext-language_tools";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/snippets/python";
import "ace-builds/src-noconflict/theme-github";

import Row from 'react-bootstrap/Row';
import Container from 'react-bootstrap/Container';
import Col from 'react-bootstrap/Col';
import Navbar from 'react-bootstrap/Navbar';
import Button from 'react-bootstrap/Button';
import ButtonToolbar from 'react-bootstrap/ButtonToolbar';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Spinner from 'react-bootstrap/Spinner';
import ProgressBar from 'react-bootstrap/ProgressBar';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle, faFile, faFolder } from '@fortawesome/free-solid-svg-icons';
import { faPython } from '@fortawesome/free-brands-svg-icons';
import { saveAs } from 'file-saver';

import { badge } from './connect.js';
import './App.scss';
import './custom-bootstrap.scss';

import worker from './worker.js';
import WebWorker from './WebWorker';




var usbConnection = null;


class FileEditor extends React.Component {
  
  constructor( props ){
    super( props );
    this.storeChanges = this.storeChanges.bind(this);
    this.setFilename = this.setFilename.bind(this);
    this.doDownload = this.doDownload.bind(this);
    this.load = this.load.bind(this);
    this.save = this.save.bind(this);
    this.fileLoaded = this.fileLoaded.bind(this);
    this.state = {filename: '', fileOperationInProgress: false};
  }
  
  storeChanges(event) {
    let filename = this.state.filename;
    let x = {}
    x[filename] = event;
    this.props.browser.current.markDirty(filename);
    this.setState(x);
    console.log(this.state);
  }

  setFilename(path) {
    console.log("Setting file to "+path);
    if (!this.state.hasOwnProperty(path)) {
      this.load(path);
    }
    this.setState({filename: path});
  }
  
  fileLoaded(path) {
    return this.state.hasOwnProperty(this.state.filename);
  }
  
  save() {
    this.setState({fileOperationInProgress: true});
    var cm = this.props.connection_manager.current;
    cm.startAction();
    var filename = this.state.filename;
    var cmd = {"cmd": "write", path: filename, data: this.state[filename]};
    
    usbConnection.send(cmd).then((e) => { 
      cm.completeAction();
      this.props.browser.current.markClean(filename);
      this.setState({fileOperationInProgress: false});
    }).catch((e) => {
      cm.completeAction();
      this.setState({fileOperationInProgress: false});
      alert(e);
      
    });
  }
  
  editorForFile (path) {
    let path_parts = path.split("/");
    let filename = path_parts[path_parts.length - 1];
    if (filename.endsWith(".py")) {
      return "python";
    } else if (filename.endsWith(".json")) {
      return "json";
    } else if (filename == "version") {
      return "text";
    } else {
      return null;
    }
  }
  
  load(path) {
    var editor_type = this.editorForFile(path);
    var cm = this.props.connection_manager.current;

    cm.startAction();
    usbConnection.send({"cmd": "stat", path: path}).then((response) => {
        this.setState({"stat": response.result});
        cm.completeAction();
      });
    
    if (editor_type !== null) {
      // Only load the file if it's editable
      this.setState({fileOperationInProgress: true});
      cm.startAction();
      
      console.log("Reading " + path + " for editor type " + editor_type);
      var cmd = {"cmd": "read", path: path};
      usbConnection.send(cmd).then((response) => { let data = {}; data[path] = response.result; this.setState(data); 
        cm.completeAction();
        this.props.browser.current.markClean(path);
        this.setState({fileOperationInProgress: false});
      });
    }
  }

  doDownload(evt) {
    var cm = this.props.connection_manager.current;
    cm.startAction();
    var total_bytes = this.state.stat.size;
    
    var path_parts = this.state.filename.split("/");
    usbConnection.getFile({"cmd": "read", path: this.state.filename}, (bytes_downloaded) => {
      this.setState({"progress": (bytes_downloaded/total_bytes*100)});
    }).then((response) => {
      cm.completeAction();
      var blob = new Blob(response.bytes);
      console.log("Response bytes " + response.bytes.length);
      console.log("Blob bytes " + blob.length);
      saveAs(blob, path_parts[path_parts.length - 1]);
      this.setState({"progress": 0});
    });
  }

  render() {
    var editor_type = this.editorForFile(this.state.filename);
    let downloading = <div className="BtnProgress" />;
    if (this.state.progress) {
      downloading = <ProgressBar className="BtnProgress" now={this.state.progress} label={Math.round(this.state.progress) + '%'} />
    }
    if (this.state.filename == "") {
      var editor = <div className="p-3">
          <h2>No file selected</h2>
          <p>Select a file to edit</p>
        </div>;
    }
    else if (editor_type === null) {
      var editor = <div className="p-3">
        <h2>Download</h2>
        <p>The file <kbd>{this.state.filename}</kbd> cannot be edited online</p>
        
        <Button variant="warning" onClick={ this.doDownload }>Download<br/>
        { downloading }
        </Button>
        </div>
    } else {
      var editor = <div>
        <AceEditor
          mode={editor_type}
          theme="github"
          name="filecontents"
          width="100%"
          height="600px"
          fontSize={14}

          wrapEnabled={true}
          value={ this.state[this.state.filename] }
          onChange={this.storeChanges}
          enableBasicAutocompletion={editor_type == "python"}
          enableLiveAutocompletion={editor_type == "python"}
          enableSnippets={editor_type == "python"}
        />
        <ButtonToolbar aria-label="Toolbar with button groups">
          <ButtonGroup className="mr-2" aria-label="File operations">
            <Button variant="outline-secondary" onClick={this.save} disabled={this.state.fileOperationInProgress}>Save to badge</Button>
            <Button variant="outline-secondary" onClick={() => {this.load(this.state.filename)}} disabled={this.state.fileOperationInProgress}>Revert to last saved</Button>
          </ButtonGroup>
        </ButtonToolbar>
      </div>;
    }
    
    return <div className="editor">
      { editor }
      
    </div>
  }
}

class Connection extends React.Component {
  
  constructor( props ){
    super( props );
    this.on_error = this.on_error.bind(this);
    this.connect = this.connect.bind(this);
    this.startAction = this.startAction.bind(this);
    this.completeAction = this.completeAction.bind(this);
    this.state = {
      "connected": false,
      "operationInProgress": 0,
    }
    
  }
  
  on_error(error_data) {
    alert(error_data);
  };
  
  startAction() {
    this.setState((prevState, props) => ({
      operationInProgress: prevState.operationInProgress + 1
    })); 
  }

  completeAction() {
    this.setState((prevState, props) => ({
      operationInProgress: prevState.operationInProgress - 1
    })); 
  }

  
  connect() {
    this.startAction();
    badge.connect().then((conn) => { 
      // Open interface
      conn.onError = this.on_error;
      conn.receive_worker = new WebWorker(worker);
      conn.receive_worker.onmessage = conn.receive_message;
      conn.connect();
      return conn;
    }).then((active) => {
      // Mark as ready
        this.setState({connected: true});
        
        console.log(this.receive_worker);

        
        usbConnection = active;
        this.completeAction();

    }).catch((data) => {
      this.completeAction();
      this.on_error(data);
    });
  }
  
  render() {
    
    if (this.state.operationInProgress) {
      var spin = <span><Spinner size="sm" animation="border" /> {this.state.operationInProgress}</span>;
    } else {
      var spin = "Idle";
    }

    return <div>
      <ButtonGroup className="mr-auto" aria-label="Connection info">
        <Button variant={ this.state.connected ? "danger" : "primary" } onClick={this.connect} id="connect">{ this.state.connected ? "Disconnect" : "Connect" }</Button>
        <Button variant="outline-secondary" disabled={true}>{spin}</Button>
      </ButtonGroup>
    </div>
  }
}


class FileBrowser extends React.Component {
  
  constructor( props ){
    super( props );
    this.state = {"tree": [], "dirty": []};
    this.getTree = this.getTree.bind(this);
    this.drawItems = this.drawItems.bind(this);
    this.refresh = this.refresh.bind(this);
  }
  
  
  markDirty(filename) {
    this.setState((prevState, props) => ({
      dirty: (prevState.dirty.indexOf(filename) === -1 ? prevState.dirty.concat([filename]) : prevState.dirty)
    }));
  }

  markClean(filename) {
    this.setState((prevState, props) => ({
      dirty: prevState.dirty.filter(function(value, index, arr){
        return value != filename;
    })
    })); 
  }
  
  async getTree(path) {
    var files = [];
    try {
      this.props.connection_manager.current.startAction();
      var items = await usbConnection.send({"cmd": "lsdir", path: path});
    } catch (e) {
      this.props.connection_manager.current.completeAction();
      if (e.ok == false) {
        return null;
      }
      throw e;
    }
    this.props.connection_manager.current.completeAction();
    for (var i = 0; i < items.result.length; i++) {
      let filename = items.result[i];
      if (path == "/") {
        path = "";
      }
      let subpath = path + "/" + filename;
      let me = await this.getTree(subpath);
      files = files.concat([{"path": subpath, "filename": filename, "children": me}])
    };
    return files;
  }
  
  
  iconForType (filename) {
    if (filename.indexOf(".py") != -1) {
      return faPython;
    } else {
      return faFile;
    }
  }
  
  drawItems(items) {
    var results = []
    for (var i = 0; i < items.length; i++) {
      let item = items[i];
      if (item.children == null) {
        let changes = this.state.dirty.indexOf(item.path) !== -1 ? "changes" : "";
        let selected = this.state.current == item.path ? "selected" : "";
        results.push(<li className={ [changes, selected].join(' ') } onClick={
          (evt) => {
            this.setState({current: item.path});
            this.props.editor.current.setFilename(item.path);
          } }><FontAwesomeIcon icon={this.iconForType(item.filename)} /> {item.filename}</li>);
      } else {
        let children = this.drawItems(item.children);
        let run = (evt) => {
          usbConnection.send({"cmd": "exec_app", app: item.filename});
        };
        results.push(<li><strong><FontAwesomeIcon icon={faFolder} /> { item.filename } <Button size="sm" onClick={run}>Run</Button> </strong>{ children }</li>);
      }
    };
    return <ul>{results}</ul>
  };
  
  refresh = function (evt) {
    this.getTree("/apps").then(files => {
      this.setState({tree: files});
    });
  };
  
  render() {  
    console.log(this.state);
    return <div className="filebrowser">
      { this.drawItems(this.state.tree) }
      <Button variant="danger" onClick={this.refresh}>Refresh</Button>
      <Button variant="success" onClick={async (evt) => {
        var app_name = prompt("Name of app");
        var exists = true;
        try {
          await usbConnection.send({"cmd": "stat", path: "/apps/"+app_name});
        } catch (e) {
          exists = false;
        }

        if (exists) {
          alert("Application name already in use");
        } else {
          await usbConnection.send({"cmd": "mkdir", path: "/apps/"+app_name});
          await usbConnection.send({"cmd": "write", path: "/apps/"+app_name+"/__init__.py", data: ""});
          this.refresh(evt);
        }
      }}>New Application</Button>
      
    </div>;
  }
}

class App extends React.Component {
  
  constructor(props) {
    super(props);
    this.connection_manager = React.createRef();
    this.editor = React.createRef();
    this.browser = React.createRef();
  }
  
  render() {
    return (
      <div className="App">
        <Navbar collapseOnSelect expand="md" bg="dark" variant="dark" className="d-flex mr-auto">
          <Navbar.Brand>
          tIDE
          </Navbar.Brand>
          <Navbar.Text><Connection ref={ this.connection_manager} /></Navbar.Text>
        </Navbar>
        <Container fluid className="outer">
          <Row noGutters>
            <Col></Col>
          </Row>
          <Row>
            <Col md={4}><FileBrowser connection_manager={ this.connection_manager} editor={ this.editor } ref={this.browser}/></Col>
            <Col md={8}><FileEditor connection_manager={ this.connection_manager} browser={this.browser} ref={ this.editor } /></Col>
          </Row>
        </Container>
        
      </div>
    );
  }
}

export default App;
