import React from 'react';
import logo from './logo.svg';
import AceEditor from "react-ace";

import "ace-builds/src-min-noconflict/ext-language_tools";
import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/snippets/python";
import "ace-builds/src-noconflict/theme-github";

import Row from 'react-bootstrap/Row'
import Container from 'react-bootstrap/Container'
import Col from 'react-bootstrap/Col'
import Navbar from 'react-bootstrap/Navbar'
import Button from 'react-bootstrap/Button'
import ButtonToolbar from 'react-bootstrap/ButtonToolbar'
import ButtonGroup from 'react-bootstrap/ButtonGroup'


import { badge } from './connect.js';
import './App.scss';
import './custom-bootstrap.scss';



var usbConnection = null;



class FileEditor extends React.Component {
  
  constructor( props ){
    super( props );
    this.storeChanges = this.storeChanges.bind(this);
    this.setFilename = this.setFilename.bind(this);
    this.load = this.load.bind(this);
    this.save = this.save.bind(this);
    this.fileLoaded = this.fileLoaded.bind(this);
    this.state = {filename: ''};
  }
  
  storeChanges(event) {
    let filename = this.state.filename;
    let x = {}
    x[filename] = event;
    this.setState(x);
    console.log(this.state);
  }

  setFilename(path) {
    console.log("Setting file to "+path);
    this.setState({filename: path});
  }
  
  fileLoaded(path) {
    return this.state.hasOwnProperty(this.state.filename);
  }
  
  componentDidUpdate(prevProps, prevState) {
    if (!this.fileLoaded(this.state.filename)) {
      this.load();
    }
  }
  
  save() {
    var cmd = {"cmd": "write", path: this.state.filename, data: this.state[this.state.filename]};
    
    usbConnection.send(cmd).then((e) => { 
      
    }).catch((e) => {
      alert(e);
      
    });
  }
  
  load() {
    var cmd = {"cmd": "read", path: this.state.filename};
    usbConnection.send(cmd).then((response) => { let data = {}; data[this.state.filename] = response.result; this.setState(data); });
  }


  render() {
    return <div className="editor">
      
      <ButtonToolbar aria-label="Toolbar with button groups">
        <ButtonGroup className="mr-2" aria-label="First group">
          <Button variant="secondary" onClick={this.save} >Save to badge</Button>
          <Button variant="secondary" onClick={this.load} >Revert to last saved</Button>
        </ButtonGroup>
      </ButtonToolbar>
    
      <br />

      <AceEditor
        mode="python"
        theme="github"
        name="filecontents"
        width="100%"
        height="100%"
        
        value={ this.state[this.state.filename] }
        onChange={this.storeChanges}
        enableBasicAutocompletion={true}
        enableLiveAutocompletion={true}
        enableSnippets={true}
      />
    <br />
    </div>
  }
}

class Connection extends React.Component {
  
  constructor( props ){
    super( props );
    this.on_error = this.on_error.bind(this);
    this.connect = this.connect.bind(this);
    this.state = {
      "connected": false
    }
    
  }
  
  on_error(error_data) {
    alert(error_data);
  };
  
  connect() {
    console.log(badge);
    badge.connect().then((conn) => { 
      // Open interface
      conn.onError = this.on_error;
      conn.connect();
      return conn;
    }).then((active) => {
      // Mark as ready
        this.setState({connected: true});
        usbConnection = active;
    }).catch(this.on_error);
  }
  
  render() {
    return <div>
      <Button variant={ this.state.connected ? "danger" : "primary" } onClick={this.connect} id="connect">{ this.state.connected ? "Disconnect" : "Connect" }</Button>
    </div>
  }
}


class FileBrowser extends React.Component {
  
  constructor( props ){
    super( props );
    this.state = {"tree": []};
    this.getTree = this.getTree.bind(this);
    this.drawItems = this.drawItems.bind(this);
  }
  
  async getTree(path) {
    var files = [];
    try {
      var items = await usbConnection.send({"cmd": "lsdir", path: path});
    } catch (e) {
      if (e.ok == false) {
        return null;
      }
      throw e;
    }
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
  
  drawItems(items) {
    var results = []
    for (var i = 0; i < items.length; i++) {
      let item = items[i];
      if (item.children == null) {
        results.push(<li onClick={
          (evt) => this.props.editor.current.setFilename(item.path) }>{item.filename}</li>);
      } else {
        let children = this.drawItems(item.children);
        let run = (evt) => {
          usbConnection.send({"cmd": "exec_app", app: item.filename});
        };
        results.push(<li><strong>{ item.filename } <Button size="sm" onClick={run}>Run</Button> </strong><ul>{ children }</ul></li>);
      }
    };
    return <ul>{results}</ul>
  };
  
  render() {
    console.log(this.state);
    return <div>
      { this.drawItems(this.state.tree) }
      <Button variant="danger" onClick={evt => {
        this.getTree("/apps").then(files => {
          this.setState({tree: files});
        });
      }}>Refresh</Button>
    </div>;
  }
}

class App extends React.Component {
  
  constructor(props) {
    super(props);
    this.editor = React.createRef();
  }
  
  render() {
    return (
      <div className="App">
        <Navbar collapseOnSelect expand="md" bg="dark" variant="dark" className="d-flex mr-auto">
          <Navbar.Brand>
          tIDE
          </Navbar.Brand>
          <Navbar.Text><Connection /></Navbar.Text>
        </Navbar>
        <Container fluid className="outer">
          <Row noGutters>
            <Col></Col>
          </Row>
          <Row>
            <Col md={4}><FileBrowser editor={ this.editor }/></Col>
            <Col md={8}><FileEditor ref={ this.editor } /></Col>
          </Row>
        </Container>
        
      </div>
    );
  }
}

export default App;
