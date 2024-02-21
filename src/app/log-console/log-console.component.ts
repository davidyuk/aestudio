import { Component, OnInit, Input, Output, EventEmitter, ChangeDetectorRef, Inject, ViewChild } from '@angular/core';
import { EventlogService } from '../services/eventlog/eventlog.service'
import { StateService } from '../services/state.service';
import { TerminalPrompt } from '../repl-terminal/TerminalPrompt';
import { StorageService } from 'ngx-webstorage-service';
import { LocalStorageService } from '../local-storage.service';
import { Socket } from 'phoenix-channels';
import { ILog } from '../helpers/interfaces';
import { TerminalComponent } from '../repl-terminal/terminal.component';

@Component({
  selector: 'app-log-console',
  templateUrl: './log-console.component.html',
  styleUrls: ['./log-console.component.css']
})

export class LogConsoleComponent implements OnInit {

  @ViewChild('terminal', {static: false}) terminal: TerminalComponent;
  logs: ILog[] = [];
  activeTab : string = 'logs'

  public login = 'you';
    public server = 'REPL';
    //public serverUrl = 'wss://repl.aeternity.io/';
    public serverUrl = 'wss://pr-67-repl.stg.aepps.com';
    public session = '';
    private channel;
    private prompt;

    private pending_output = "";
    public isReplFocused: boolean = false;

  constructor(private eventlog: EventlogService, public state: StateService, private detector: ChangeDetectorRef,  private localStorage: LocalStorageService) {
    // use this to get all contracts in their latest state:

    let socket = new Socket(this.serverUrl + "/socket");
    socket.connect();
    console.log("REPL: socket " + socket);
    this.channel = socket.channel("repl_session:lobby", {});
    console.log("REPL: channel " + this.channel);

    console.log("REPL: trying to join");

    this.channel.join()
      .receive("ok", resp => { console.log("REPL: channel join", resp);
                                debugger;
                               this.handleResponse(resp);
                               })
                               
      .receive("error", resp => {
        console.log("REPL: Could not establish the connection.");
        alert("Could not establish the connection.");
      });

  }

  onCommand(prompt: TerminalPrompt) {
    debugger
    this.prompt = prompt;

    let input = prompt.text;

    console.log("REPL: Input:" + input);
    switch (input.trim()) {

      // TODO investigate: after every :r, the onCommand method is called one time more than before, the result of the call remains just one though ?!
      // TODO: when setting a breakpoint before a contract is actually created with chain.create, breaking doesnt happen
      case ':r':
       this.loadAllContracts();

        break;

        default:
        this.channel.push("query", {input: input,
                                    user_session: this.session
                                   })
                                   .receive("ok", (response)=> {debugger; this.handleResponse(response)})
                                   .receive("error", (response)=> {debugger; this.handleResponse(response)});

debugger

        //this.prompt.response = '...';
        //prompt.responseComplete();
    }
  }

  loadAllContracts() {
    let contracts_raw = this.localStorage.getAllContracts();
    let contracts = contracts_raw.map(
      function(c) {
  
          let filename = (c as any).nameInTab + ".aes";
          let content = (c as any).code;
          return {
              filename: filename,
              content: content
          }
    }
    
    );
  
    let contractNamesOnly = contracts_raw.map(
    function(c) {
        let filename = (c as any).nameInTab + ".aes";
        return filename
    }
    );

    contractNamesOnly
    debugger;
    
    // upload to repl
    this.channel.push("update_files", 
                            {files: contracts,
                              user_session: this.session
                            }).receive("ok", (response)=> {
                              this.handleResponse(response)
                              debugger;
                            });
  
                            contractNamesOnly
                            debugger
    // make repl load the contracts
    this.channel.push("load",
            /* {files: contractNamesOnly, */
            {files: ["C.aes"],
            user_session: this.session
            }).receive("ok", (response)=> {
              this.handleResponse(response)
            debugger
            })
            .receive("error", (response)=> {
            debugger
            })
            /* .receive("ok", (response)=> {this.handleResponse(response)})
              .receive("error", resp => { console.log("REPL: error loading:", resp);
            }); */
            
  
    }

  logActiovated($event){
    console.log("damn")
  }

  ngOnInit() {
    // setup a default first log:
    // example log: ({type: "success", message: "Contract was called successfully!", contract: "testcontract", data: {}})

    this.logs.push({type: "info", message: "Event log initialized.", data: { Info: "Here you will find all information on your activities."}, expanded: true });

    //setup subscription for new logs
    this.eventlog._newLog.subscribe((log : ILog) => {
      //empty default log message when first true log comes in
      this.logs[this.logs.length - 1].message == "Event log initialized." ? this.logs = [] : ""; 
      // check if the new log is expanded, if not, explicitly set it to true
      log.expanded == undefined ? log.expanded = true : "";
      // set the last log to not expanded
      this.logs.length >= 1 ? this.logs[this.logs.length - 1].expanded = false : "";
      this.logs.push(log);
    })
  }

  stopClickPropagation($event) {
    $event.stopPropagation()
  }

  showTabContent(tab: "logs" | "repl"){
    this.activeTab = tab
  }

  setIsReplFocused(setting : boolean){
    this.isReplFocused = setting
    this.terminal.setFocused(setting)
  }

  toggle($event) {
    console.log("Resize: click initiated")
    this.state.consoleOpen = !this.state.consoleOpen
    this.detector.detectChanges()
    //setTimeout(() => {
      this.state.consoleTrigger.emit()
    //}, 1000);

    console.log("state console open: ", this.state.consoleOpen)
  }

  handleResponse(payload) {
    var msg = payload.msg;
    console.log("REPL: " + msg);
    this.session = payload.user_session ? payload.user_session : this.session;
    msg = payload.msg.replace(/^\n|\n$/g, '');
    if(msg !== "" /* && this.prompt */) {
      console.log("REPL: Handling response")
      this.prompt.setAnsiResponse(this.pending_output + msg);
      //debugger;
      this.pending_output = "";
      this.prompt.responseComplete();
    } else if (msg == "") {
      console.log("REPL: Handling empty response")
      this.pending_output = "";
      this.prompt.responseComplete();
    } 
      else {
      console.log("REPL: Pending msg...")
      this.pending_output += msg + "\n\n";
    }

  }


}
