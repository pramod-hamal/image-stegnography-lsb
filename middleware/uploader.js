const multer = require("multer");
//node native module = path
const path = require("path");
function sanitizeFileName(fileName) {
  // Define a regular expression to match unsafe characters
  var unsafeChars = /[<>:"\/\\|?*\x00-\x1F]/g;
  
  // Replace unsafe characters with an empty string
  var sanitizedFileName = fileName.replace(unsafeChars, '');
  
  return sanitizedFileName;
}

function fileFilter(req, file, cb) {
  const imgType = file.mimetype.split("/")[0];
  console.log("file is ", file)
  // accept only png file
  if (imgType !== "image") {
    req.fileTypeErr = true;
    cb(null, false);
  }
    req.fileTypeErr = false;
    cb(null, true);
  // }
}

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), "/public/uploads"));
  },

  filename: function (req, file, cb) {
    cb(null,sanitizeFileName( Date.now() + "-" + file.originalname));
  },
});

const upload = multer({
  storage: diskStorage,
  fileFilter: fileFilter,
});
module.exports = upload;