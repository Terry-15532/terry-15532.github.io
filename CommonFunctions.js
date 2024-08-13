function $(id) {
    return document.getElementById(id);
}

function SwitchToPortfolio() {
    SwitchPage("portfolio.html", "My Portfolio", 2);
}

function SwitchToAbout() {
    SwitchPage("about.html", "About Me", 1);
}

function SetElm(id, name) {
    $(id).innerHTML = name;
}

function AddHeader() {
    fetch("header.html")
        .then(response => response.text())
        .then(data => {
            SetElm("header", data);
            SwitchPage("about.html", "About Me", 1);
        }
        );
}

function AddFooter() {
    fetch("footer.html")
        .then(response => response.text())
        .then(data => {
            SetElm("footer", data);
        }
        );
}

var currHeader = "";

function ChangeHeader(header) {
    var h = $(header);
    SetElm("headerTitle", header);
    h.style.pointerEvents = "none";
    h.style.textShadow = "0px 0px 20px rgb(0, 233, 255)";
    if (currHeader != header) {
        let tmp = currHeader;
        currHeader = header;
        DispLine(header + "_Line");
        $(tmp).style = "transition: text-shadow 300ms;";
        HideLine(tmp + "_Line");
    }
}

currIndex = -1;

var histories = [];
// var currPage = { filename: "about.html", header: "About Me", index: 1 };
var currPage = null;
var loading = false;
var posInHist = -1;

function SwitchPage(filename, header, index, blockHist) {
    // if (header == currHeader) {
    //     e.preventDefault();
    //     return;
    // }

    if (!loading) {
        loading = true;
        fetch(filename)
            .then(response => response.text())
            .then(data => {
                loading = false;
                document.documentElement.scrollTop = 0;
                if (index >= currIndex) {
                    MoveAndReplaceBody_Right(data);
                }
                else {
                    MoveAndReplaceBody_Left(data);
                }
                currIndex = index;
                ExecuteScript(data);
                ChangeHeader(header);
            })
        if (!blockHist) {

            histories = histories.slice(0, posInHist + 1);
            window.histories.slice(0, posInHist + 1);

            currPage = { filename: filename, header: header, index: index };

            histories.push(currPage);
            window.history.pushState({ time: getDate() }, "");

            posInHist++;
        }
    }
}

function getDate() {
    const now = new Date();
    var time = "";
    time += ('0' + (now.getMonth() + 1)).slice(-2);
    time += ('0' + now.getDate()).slice(-2);
    time += ('0' + now.getHours()).slice(-2);
    time += ('0' + now.getMinutes()).slice(-2);
    time += ('0' + now.getSeconds()).slice(-2);
    time += ('000' + now.getMilliseconds()).slice(-3);
    return parseInt(time);
}

currTime = 0;

function Back() {
    if (posInHist > 0) {
        posInHist--;
        let hist = histories[posInHist];
        SwitchPage(hist.filename, hist.header, hist.index, true);
    }

}

function Forward() {
    if (posInHist < histories.length - 1) {
        posInHist++;
        let hist = histories[posInHist];
        SwitchPage(hist.filename, hist.header, hist.index, true);
    }
}

function MoveAndReplaceBody_Right(content) {
    const body = document.getElementById("body");

    const oldBody = document.createElement("div");
    oldBody.id = "oldBody";
    oldBody.style.position = "absolute";
    oldBody.style.width = "100%";
    oldBody.style.transition = "transform 500ms";
    oldBody.style.top = "110px";

    oldBody.innerHTML = body.innerHTML;
    body.innerHTML = "";
    document.body.appendChild(oldBody);

    setTimeout(() => {
        oldBody.style.transform = "translateX(-200%)";
    }, 10);

    const newContent = document.createElement("div");
    newContent.innerHTML = content;
    newContent.style.position = "static";
    newContent.style.width = "100%";
    newContent.style.transform = "translateX(200%)";
    newContent.style.transition = "transform 500ms";
    newContent.style.top = "110px";
    body.appendChild(newContent);

    setTimeout(() => {
        newContent.style.transform = "translateX(0%)";
    }, 10);

    setTimeout(() => {
        oldBody.remove();
    }, 600);
}

function MoveAndReplaceBody_Left(content) {
    const body = document.getElementById("body");

    const oldBody = document.createElement("div");
    oldBody.id = "oldBody";
    oldBody.style.position = "absolute";
    oldBody.style.width = "100%";
    oldBody.style.transition = "transform 500ms";
    oldBody.style.top = "110px";

    oldBody.innerHTML = body.innerHTML;
    body.innerHTML = "";
    document.body.appendChild(oldBody);

    setTimeout(() => {
        oldBody.style.transform = "translateX(200%)";
    }, 10);

    const newContent = document.createElement("div");
    newContent.innerHTML = content;
    newContent.style.position = "static";
    newContent.style.width = "100%";
    newContent.style.transform = "translateX(-200%)";
    newContent.style.transition = "transform 500ms";
    newContent.style.top = "110px";
    body.appendChild(newContent);

    setTimeout(() => {
        newContent.style.transform = "translateX(0%)";
    }, 10);

    setTimeout(() => {
        oldBody.remove();
    }, 600);
}

async function alertEmail() {
    await navigator.clipboard.writeText("kafuuchino_15532@foxmail.com");
    setTimeout(async () => {
        alert("My Email Address: kafuuchino_15532@foxmail.com\n\nThe email address is copied to your clipboard. If the default email software doesn't pop out, please enter this address manually in your email software.");
    }, 1);
}

function MoveElement(fromID, toID) {
    let element = $(fromID);
    if (element) {
        $(toID).appendChild(element);
    }
}

function AddFileAt(id, filename, executeScript) {
    fetch(filename)
        .then(response => response.text())
        .then(data => {
            $(id).innerHTML = data;
            if (executeScript) {
                ExecuteScript(data);
            }
        })
}

function ExecuteScript(content) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(content, 'text/html');
    let scripts = doc.getElementsByClassName("script");
    let scriptContent;
    Array.from(scripts).forEach(element => {
        scriptContent += element.innerHTML;
    });
    eval(scriptContent);
}

function DispLine(id) {
    let e = $(id);
    e.style.height = "35px";
    e.style.marginTop = "10px";

}

function HideLine(id) {
    if (currHeader + "_Line" != id) {
        let e = $(id);
        e.style.height = "0px";
        e.style.marginTop = "22.5px";
    }
}

function Clamp(input, min, max) {
    if (input > max) {
        return max;
    }
    else if (input < min) {
        return min;
    }
    return input;
}
