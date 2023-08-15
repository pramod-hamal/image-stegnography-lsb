const express = require("express");
const app = express();
const http = require("http");
const path = require("path");
const upload = require("./middleware/uploader");
const Jimp = require("jimp");
const fs = require("fs");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use("/public", express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));

function decimalTo8BitBinary(decimal) {
  if (decimal < 0 || decimal > 255) {
    throw new Error("Decimal number must be between 0 and 255.");
  }

  let binary = "";
  for (let i = 7; i >= 0; i--) {
    binary += (decimal >> i) & 1;
  }

  return binary;
}

function binary8BitToDecimal(binaryString) {
  if (binaryString.length !== 8) {
    throw new Error("Binary string must be exactly 8 bits long.");
  }

  let decimal = 0;
  for (let i = 0; i < 8; i++) {
    if (binaryString[i] !== "0" && binaryString[i] !== "1") {
      throw new Error("Invalid binary string format.");
    }
    decimal += parseInt(binaryString[i]) * Math.pow(2, 7 - i);
  }

  return decimal;
}

function replaceLetterAtIndex(inputString, index, newLetter) {
  if (index < 0 || index >= inputString.length) {
    throw new Error("Index is out of range.");
  }

  const beforeIndex = inputString.substring(0, index);
  const afterIndex = inputString.substring(index + 1);
  const modifiedString = beforeIndex + newLetter + afterIndex;

  return modifiedString;
}

function binaryToString(binary) {
  if (binary.length % 8 != 0) {
    return;
  }
  let result = "";
  for (let i = 0; i < binary.length; i += 8) {
    const chunk = binary.slice(i, i + 8);
    const decimalValue = parseInt(chunk, 2);
    const asciiCharacter = String.fromCharCode(decimalValue);
    result += asciiCharacter;
  }
  return result;
}

async function hideMessageInImage(
  imagePath,
  message,
  secretKey,
  outputImagePath
) {
  try {
    const image = await Jimp.read(imagePath);
    const keyBinary = secretKey
      .split("")
      .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
      .join("");

    console.log(keyBinary);
    let messageBinary =
      message
        .split("")
        .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
        .join("") + keyBinary;
    let bitIndex = 0;

    // Iterate through each pixel and modify the least significant bit
    for (let y = 0; y < image.bitmap.height; y++) {
      for (let x = 0; x < image.bitmap.width; x++) {
        const pixel = image.getPixelColor(x, y);
        var { r, g, b } = Jimp.intToRGBA(pixel);

        let binary;
        // console.log("bit ind", bitIndex, messageBinary.length)
        if (bitIndex < messageBinary.length) {
          binary = decimalTo8BitBinary(r);
          binary = replaceLetterAtIndex(binary, 7, messageBinary[bitIndex]);
          r = binary8BitToDecimal(binary);
          bitIndex++;
          // convert to binary
        }

        if (bitIndex < messageBinary.length) {
          binary = decimalTo8BitBinary(g);
          binary = replaceLetterAtIndex(binary, 7, messageBinary[bitIndex]);
          g = binary8BitToDecimal(binary);
          bitIndex++;
          // convert to binary
        }

        if (bitIndex < messageBinary.length) {
          binary = decimalTo8BitBinary(b);
          binary = replaceLetterAtIndex(binary, 7, messageBinary[bitIndex]);
          b = binary8BitToDecimal(binary);
          bitIndex++;
          // convert to binary
        }

        // if(bitIndex >= messageBinary.length) {
        //   return;
        // }
        const modifiedPixel = Jimp.rgbaToInt(r, g, b, 255);
        image.setPixelColor(modifiedPixel, x, y);
      }
    }

    await image.writeAsync(outputImagePath);
    console.log("Message hidden in image successfully!");
  } catch (error) {
    console.error("Error:", error);
  }
}

async function extractMessageFromImage(imagePath, secretKey) {
  try {
    const image = await Jimp.read(imagePath);

    let extractedMessageBinary = "";
    let extractedMessage = "";

    // Iterate through each pixel and extract the least significant bit
    for (let y = 0; y < image.bitmap.height; y++) {
      for (let x = 0; x < image.bitmap.width; x++) {
        const pixel = image.getPixelColor(x, y);
        const { r, g, b } = Jimp.intToRGBA(pixel);

        let binary = "";
        // r
        binary = decimalTo8BitBinary(r);
        extractedMessageBinary += binary.slice(-1).toString();
        extractedMessage = binaryToString(extractedMessageBinary);
        if (extractedMessage && extractedMessage.includes(secretKey)) {
          return extractedMessage.replaceAll(secretKey, "");
        }

        // g

        binary = decimalTo8BitBinary(g);
        extractedMessageBinary += binary.slice(-1).toString();
        extractedMessage = binaryToString(extractedMessageBinary);
        if (extractedMessage && extractedMessage.includes(secretKey)) {
          return extractedMessage.replaceAll(secretKey, "");
        }

        // b
        binary = decimalTo8BitBinary(b);
        extractedMessageBinary += binary.slice(-1).toString();
        extractedMessage = binaryToString(extractedMessageBinary);
        if (extractedMessage && extractedMessage.includes(secretKey)) {
          return extractedMessage.replaceAll(secretKey, "");
        }

        console.log("extracted binary", extractedMessageBinary);
      }
    }
    return extractedMessage;
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

app.get("/", function (req, res) {
  res.render("index");
});

app.get("/hide-message", function (req, res) {
  res.render("hideMessage");
});

app.post("/hide-message", upload.single("image"), async function (req, res) {
  if (!req.file) {
    console.log("file not uploaded", req.file);
  }
  const { message, secretKey } = req.body;
  const imagePath = req.file.path;

  const outputImagePath = path.join(
    __dirname,
    "public",
    "uploads",
    "output-" + req.file.filename
  );
  await hideMessageInImage(imagePath, message, secretKey, outputImagePath);
  res.download(outputImagePath);
  // delete both file after download
  // fs.unlink(imagePath, function(err,done){});
  // fs.unlink(outputImagePath, function(err,done){});
});

app.get("/extract-message", function (req, res) {
  res.render("extractMessage", { message: null });
});

app.post(
  "/extract-message-image",
  upload.single("image"),
  async function (req, res) {
    if (!req.file) {
      console.log("file not uploaded", req.file);
    }
    const { secretKey } = req.body;
    const imagePath = path.join(
      process.cwd(),
      `/public/uploads/${req.file.filename}`
    );

    console.log(imagePath, secretKey);
    const message = await extractMessageFromImage(imagePath, secretKey);
    console.log("message  ", message);
    if (!message) {
      res.render("output", { message: "No message found" });
      return;
    }
    res.render("output", { message });
  }
);
const PORT = 9090;
const server = http.createServer(app);

server.listen(PORT);
server.on("listening", function () {
  console.log(`Server is running on http://localhost:${PORT}/.`);
});
