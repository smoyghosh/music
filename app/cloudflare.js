const config = require("../config");
const {
    S3Client,
    ListBucketsCommand,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand
} = require ("@aws-sdk/client-s3");
const { getSignedUrl } = require ("@aws-sdk/s3-request-presigner");
const fs = require('fs');
const PassThrough = require('stream').PassThrough;
const Throttle = require('throttle');
const logger = require("./logger");

const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${config.nodeserver.r2_s3_account_id}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: config.nodeserver.r2_s3_access_key_id,
        secretAccessKey: config.nodeserver.r2_s3_key_secret,
    },
});

const cloudflare = {};

cloudflare.getSignedUrl = async function (params) {
    try {
        let ObjectCommandInput = {Bucket: params.bucket, Key: params.key};
        if (params.expiresIn == undefined){
            params.expiresIn = config.nodeserver.surl_time;        
        }         
        if (params.download === true){
            if(params.fileName ==''){
                params.fileName = 'download';
            }
            params.fileName += '.'+params.key.split('.').pop();
            ObjectCommandInput.ResponseContentDisposition = `attachment; filename="${params.fileName}"`;            
        }
        return await getSignedUrl(S3, new GetObjectCommand(ObjectCommandInput), {expiresIn:params.expiresIn});
    } catch (error) {
        logger.log(error);
        return '';     
    }
}

cloudflare.upload = async function (params) {
    try {        
        const readSteam = fs.createReadStream(params.filelocation+'/'+params.filename);
        const stats = fs.statSync(params.filelocation+'/'+params.filename);        
        let putCommand = new PutObjectCommand({
            Bucket: params.bucket,
            Key: params.filename,
            Body: readSteam.pipe(new Throttle(3000000)),  // 3 MB/s
            ContentLength: stats.size
        });
        await S3.send(putCommand);
        return true;     
    } catch (error) {
        logger.log(error);
        return false;     
    } finally {
        fs.rmSync(params.filelocation+'/'+params.filename, { recursive: true, force: true });      
    }
}

module.exports = cloudflare;