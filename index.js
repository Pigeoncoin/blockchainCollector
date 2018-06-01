const rpc = require('./rpc.js');
const moment = require('moment');
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const SqlString = require('sqlstring');
const app = express();

//every minute poll,  add new blocks

var prevBlockHeight = 0;


function emitLog(msg) {
    console.log(msg);
}

function init() {
    //get last block
    conn.query('select height from blockchain order by height desc limit 1', (err, result, fields) => {
        if(err){
            console.log("Error getting last block from database\n\t" + err)
        } else {
            if(result[0]) { 
  	    	prevBlockHeight = result[0].height;
	    }
	     else {prevBlockHeight = 0; }
            rpc.getBlockCount().then((height) => {
                console.log(`${moment().format('MM/DD/YYYY hh:mm:ss')} - Scanning for new blocks from height: ${prevBlockHeight} to ${height}.`);
                rpc.enumerateBlockchain(prevBlockHeight+1, height);
                prevBlockHeight = height;
                setTimeout(init, 60000);
            });
        }
    });
}

app.use(bodyParser.urlencoded({ extended: true}));
var conn = mysql.createConnection({
    host     : 'localhost',
    user     : 'apiuser',
    password : 'blah99blah**',
    database : 'pgntestnet'
});

function mysql_real_escape_string (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
        }
    });
}

function buildQuery(params, res) {
    let table = "blockchain";

    let select = "";
    let limit = "limit ";
    let orderby = "";
    let dir = "";
    let cols = "";
    let where = "";

    for(let param in params) {
        switch(param) {
            case 'limit': // limit=X
                limit += params[param];
                break;
            case 'orderby': // orderby=colname
                orderby += ` order by ${params[param]} `;
                break;
            case 'dir':   // dir=(asc or desc)
                dir = params[param];
                break;
            case 'select': // select=colName,colName,colName...
                //split the string
                select = params[param];
                break;
            case 'where': //where=colName|(is|isnot|like|>|<)|value
                let vals = params[param].split('|');
                if(vals.length === 3) {
                    let str = " ";
                    let like = false;
                    if(vals[1] === "is") { 
                        str += "=";
                    }else if(vals[1] === "isnot"){
                        str += "!=";
                    }else if(vals[1] === ">"){
                        str += ">";
                    }else if(vals[1] === "<"){
                        str += "<";
                    }else if(vals[1] === "like"){
                        str += "%";
                        like = true;
                    }

                    if(like){
                        str += vals[2] +"% ";
                    }
                    
                    where = ` WHERE ${vals[0]}${str}${vals[2]} `;
                }
        }
    }

    // you cna only use desc if orderby is set
    if(orderby === "") {
        dir = ""

    }

    //we need to build in t he correct order
    
    conn.beginTransaction((err) => {
        if(err) {
            return conn.rollback(() => {console.log("dang ole error man")});
        }
        if(select === "") { select = " * "};
        let stmt = mysql_real_escape_string(`SELECT ${select} FROM ${table} ${where} ${orderby} ${dir} ${limit}`);
        //conn.query(`select ? from ${table} ? ? ? ?`,[select, where, orderby, dir, limit], (err, result, fields) => {
        conn.query(stmt, (err, result, fields) => {
            if(err){
                res.send(JSON.stringify({"status": 500, "error": err, "response": null}));
                return conn.rollback(function() {
                    console.log("dang ole error man")
                  });
            }
            conn.commit((err) => {
                if(err) {
                    return conn.rollback(() => {console.log("dang ole error man")});
                }
            });
            res.send(JSON.stringify(result));
        });    
    });
    
}

//accepted queries
//last=5  last 5 blocks
//height=x block at height x
app.get('/api/blockchain/', (req, res ,next) => {

    let stmt = "";
    if(Object.keys(req.query).length != 0 && req.query.constructor === Object) {
        buildQuery(req.query, res);
    }else {
        conn.query("select * from blockchain order by height desc", (err, result, fields) => {
            if(err){
                res.send(JSON.stringify({"status": 500, "error": err, "response": null}));
            } else {
                res.send(JSON.stringify(result));
            }
        });    
    }
    
});

app.get('/api/blockchain/lastblock/', (req, res ,next) => {
    conn.query('SELECT height from blockchain order by height desc limit 1', (err, result, fields) => {
        if(err){
            res.send(JSON.stringify({"status": 500, "error": err, "response": null}));
        } else {
            res.send(JSON.stringify(result));
        }
    }); 
});

app.listen(8008, () => {
    console.log("Web service is online");
});
init();
