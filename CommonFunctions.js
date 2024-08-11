function $(id) {
    return document.getElementById(id);
}

function switchToPortfolio() {
    SwitchPage("portfolio.html", "My Portfolio");
}

function switchToAbout() {
    SwitchPage("about.html", "About Me");
}

function setElm(id, name) {
    $(id).innerHTML = name;
}

function AddHeader() {
    fetch("header.html")
        .then(response => response.text())
        .then(data => {
            setElm("header", data);
            SwitchPage("about.html", "About Me");
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

function SwitchPage(filename, header) {
    fetch(filename)
        .then(response => response.text())
        .then(data => {
            document.documentElement.scrollTop = 0;
            setElm("Body", data);
        })
    ChangeHeader(header);
}

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