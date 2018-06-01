// i pick things up and put them down
const RpcClient = require('bitcoind-rpc');

const mysql = require('mysql');
var mysqlConn = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'password',
  database : 'pgntestnet'
});

mysqlConn.connect((err) => {
    if(err) {
        console.log("Error connecting to mysql: " + err);
        return;
    }

    console.log("Connected to mysql...");
});


const rpcConfig = {
    protocol: 'http',
    user: 'testuser',
    pass: 'testpassword',
    host: '127.0.0.1',
    port: '18756',
};

const rpc = new RpcClient(rpcConfig);


/////////////////////////

async function enumerateBlockchain(start, stop){
  const timer = Date.now()
  const returnObject = {}
  const blockHeight = await getBlockCount()
  if(stop > blockHeight) stop = blockHeight

  let previousTime = 0;
    let rows = [];
    let z =0;
  for(i=start; i<=stop; i++){
    const blockHash = await getBlockHash(i)
    const blockInfo = await getBlock(blockHash)

    let blockTime = previousTime ? blockInfo.time - previousTime : null
    previousTime = blockInfo.time

    if(z<100){
        rows.push({
            height: blockInfo.height,
            blockhash: blockHash,
            confirmations: blockInfo.confirmations,
            strippedsize: blockInfo.strippedsize,
            size: blockInfo.size,
            weight: blockInfo.weight,
            version: blockInfo.version,
            versionHex: blockInfo.versionHex,
            merkleroot: blockInfo.merkleroot,
            tx: blockInfo.tx,
            time: blockInfo.time,
            mediantime: blockInfo.mediantime,
            nonce: blockInfo.nonce,
            bits: blockInfo.bits,
            difficulty: blockInfo.difficulty,
            chainwork: blockInfo.chainwork,
            previousblockhash: blockInfo.previousblockhash,
            nextblockhash: blockInfo.nextblockhash
        })
    } else {
        // save to firebase
        addBlockToMysql(rows);
        rows = [];
        z=0;
    }
    z++;

    
  }
  //add last rows
  if(rows.length>0){
    addBlockToMysql(rows);
  }

  //console.log(`collected ${stop-start} blocks in ${((Date.now()-timer)/1000).toFixed(1)} seconds`)
}


//////////////////////////
/// mysql

function toSqlColumns(row) {
  let vals = [];
  for(var field in row) {
    var val = row[field];
    
    if(typeof field == Number){
      vals.push(val);
    } else if(typeof val == Array) {
      vals.push(val.join(','));
    } else {
      vals.push('"' + val + '"')
    }
  }
  
  return vals.join(',');
}

var count = 0;
function addBlockToMysql(rows){
    count++;
    let stmt = 'insert into blockchain values';
    let cur;
    let i=0;

    for(let data of rows ){
       let vals = toSqlColumns(data);
        stmt += `(${vals})`;
        if(i<rows.length-1){
            stmt += ',';
        }
            i++;
        
    }
    
    var log;
    mysqlConn.query(stmt, log, (err, res, fields) => {
        if(err){
            console.log("Query err: " + err);
            return mysqlConn.rollback(() =>{});
        }
        mysqlConn.commit((err) => {
            if(err) {
                console.log("Error commiting query: " + err);
            }
        });
    });
    
}

/////////////////////////
/////////////////////////

function getBlock(blockHash){
  return new Promise( resolve => {

    rpc.getBlock(blockHash, (error, response) => {
      if(error) console.log(error)
      if(response) resolve(response.result)

    })

  })
}


function getBlockHash(id){
  return new Promise( resolve => {

    rpc.getBlockHash(id, (error, response) => {
      if(error) console.log(error)
      if(response) resolve(response.result)
    })

  })
}


function getBlockCount(){
  return new Promise( resolve => {

    rpc.getBlockCount((error,response) => {
      if(error) console.log(error)
      if(response) resolve(response.result)
    })

  })
}

module.exports ={enumerateBlockchain, getBlockCount};

