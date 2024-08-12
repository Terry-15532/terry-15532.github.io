function $(id) {
    return document.getElementById(id);
}

function switchToPortfolio() {
    SwitchPage("portfolio.html", "My Portfolio", 2);
}

function switchToAbout() {
    SwitchPage("about.html", "About Me", 1);
}

function setElm(id, name) {
    $(id).innerHTML = name;
}

function AddHeader() {
    fetch("header.html")
        .then(response => response.text())
        .then(data => {
            setElm("header", data);
            SwitchPage("about.html", "About Me", 1);
        }
        );
}

function AddFooter() {
    fetch("footer.html")
        .then(response => response.text())
        .then(data => {
            setElm("footer", data);
        }
        );
}

var currHeader = "";

function ChangeHeader(header) {
    var h = $(header);
    setElm("headerTitle", header);
    dispLine(header + "_Line");
    h.style.pointerEvents = "none";
    h.style.textShadow = "0px 0px 20px rgb(0, 233, 255)";
    let tmp = currHeader;
    currHeader = header;
    hideLine(tmp + "_Line");
    $(tmp).style = "transition: text-shadow 300ms;";
}

currIndex = -1;

function SwitchPage(filename, header, index) {
    fetch(filename)
        .then(response => response.text())
        .then(data => {
            document.documentElement.scrollTop = 0;
            if (index > currIndex) {
                moveAndReplaceBody_Right(data);
            }
            else {
                moveAndReplaceBody_Left(data);
            }
            currIndex = index;
        })
    ChangeHeader(header);
}

function moveAndReplaceBody_Right(content) {
    const body = document.getElementById("body");

    const oldBody = document.createElement("div");
    oldBody.id = "oldBody";
    oldBody.style.position = "absolute";
    oldBody.style.width = "100%";
    oldBody.style.transition = "transform 500ms";
    oldBody.style.top = "90px";

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
    newContent.style.top = "90px";
    body.appendChild(newContent);

    setTimeout(() => {
        newContent.style.transform = "translateX(0%)";
    }, 10);

    setTimeout(() => {
        oldBody.remove();
    }, 600);
}

function moveAndReplaceBody_Left(content) {
    const body = document.getElementById("body");

    const oldBody = document.createElement("div");
    oldBody.id = "oldBody";
    oldBody.style.position = "absolute";
    oldBody.style.width = "100%";
    oldBody.style.transition = "transform 500ms";
    oldBody.style.top = "90px";

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
    newContent.style.top = "90px";
    body.appendChild(newContent);

    setTimeout(() => {
        newContent.style.transform = "translateX(0%)";
    }, 10);

    setTimeout(() => {
        oldBody.remove();
    }, 600);
}

// 调用函数
moveAndReplaceBodyContent();



function dispLine(id) {
    let e = $(id);
    e.style.height = "35px";
    e.style.marginTop = "10px";

}

function hideLine(id) {
    if (currHeader + "_Line" != id) {
        let e = $(id);
        e.style.height = "0px";
        e.style.marginTop = "22.5px";
    }
}