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
    DispLine(header + "_Line");
    h.style.pointerEvents = "none";
    h.style.textShadow = "0px 0px 20px rgb(0, 233, 255)";
    let tmp = currHeader;
    currHeader = header;
    HideLine(tmp + "_Line");
    $(tmp).style = "transition: text-shadow 300ms;";
}

currIndex = -1;

function SwitchPage(filename, header, index) {
    fetch(filename)
        .then(response => response.text())
        .then(data => {
            document.documentElement.scrollTop = 0;
            if (index >= currIndex) {
                MoveAndReplaceBody_Right(data);
            }
            else {
                MoveAndReplaceBody_Left(data);
            }
            currIndex = index;
            ExecuteScript(data);
        })
    ChangeHeader(header);
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
    newContent.style.position = "relative";
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

async function alertEmail() {
    await navigator.clipboard.writeText("kafuuchino_15532@foxmail.com");
    setTimeout(async () => {
        alert("My Email Address: kafuuchino_15532@foxmail.com\n\nThe email address is copied to your clipboard. If the default email software doesn't pop out, please enter this address manually in your email software.");
    }, 1);
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
    newContent.style.position = "relative";
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