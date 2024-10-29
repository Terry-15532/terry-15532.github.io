function $(id) {
    return document.getElementById(id);
}

function SwitchToProjects() {
    // if (fromAbout) {
    //     lastPos = 800;
    //     SwitchToAbout();
    //     document.scrollTop = 800;
    //     fromAbout = false;
    // }
    // else {
    SwitchPage("projects.html", "My Projects", 2);
    // }
}

var aboutPos = 0;
var zoomLevel = 1;

function SwitchToAbout() {
    if (fromAbout) {
        lastPos = aboutPos * zoomLevel;
        fromAbout = false;
    }
    SwitchPage("about.html", "About Me", 1);
}

function SwitchToArtworks() {
    if (fromAbout) {
        lastPos = aboutPos * zoomLevel;
        fromAbout = false;
    }
    SwitchPage("artworks.html", "My Artworks", 4);
}

function SetElm(id, name) {
    $(id).innerHTML = name;
}

function checkScroll() {
    var scrollPosition = window.scrollY / zoomLevel;

    if (scrollPosition >= 20 && scrollPosition <= 300) {
        HideFixedElements();
    } else {
        // alert(scrollPosition);
        ShowFixedElements();
    }
}

function HideFixedElements() {
    var elements = document.querySelectorAll("body *");
    elements.forEach(function (element) {
        var style = window.getComputedStyle(element);
        if (style.position === "fixed") {
            let dir = element.getAttribute("hiddenValue");
            element.style.transform = dir;
        }
    });
}

// Function to show fixed elements by resetting the transform property
function ShowFixedElements() {
    var elements = document.querySelectorAll("body *");
    elements.forEach(function (element) {
        var style = window.getComputedStyle(element);
        if (style.position === "fixed") {
            if (element.hasAttribute("shownValue")) {
                element.style.transform = element.getAttribute("shownValue");

            }
            else {
                element.style.transform = "";
            }
        }
    });
}

function AddProjectsPictures(name, number) {
    for (i = 1; i <= number; i++) {
        $("ProjectsPictures").innerHTML += "<img src= 'Projects/" + name + "/Pictures/" + i + ".jpeg' width = '90%' class='ProjectsDetailPicture'>";
    }
    $("ProjectsPictures").innerHTML += "<div style='height: calc(0.1 * var(--vh));'></div>"
}

function ShowUI() {
    var element = document.getElementById(id);
    if (element) {
        element.style.transform = "translateY(0)";
    }
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

lastScroll = 0;

function CheckScroll() {
    var scrollPosition = window.scrollY / zoomLevel;

    if (lastScroll < scrollPosition) {
        HideFixedElements();
    } else {
        // alert(scrollPosition);
        ShowFixedElements();
    }

    lastScroll = scrollPosition;
}

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
var lastPos = 0;

var fromAbout = false;

function SwitchPage(filename, header, index, blockHist) {
    if (!loading) {
        loading = true;
        fetch(filename)
            .then(response => response.text())
            .then(data => {
                loading = false;
                if (index >= currIndex) {
                    MoveAndReplaceBody_Right(data);
                }
                else {
                    MoveAndReplaceBody_Left(data);
                }
                ExecuteScript(data);
                ChangeHeader(header);
                if (index == 1) {
                    $("blurBG").style.backdropFilter = "blur(10px)  hue-rotate(0deg)";
                }
                else if (index == 2) {
                    $("blurBG").style.backdropFilter = "blur(10px)  hue-rotate(33deg)";
                }
                else if (index == 3) {
                    $("blurBG").style.backdropFilter = "blur(10px)  hue-rotate(66deg)";
                }
                else if (index == 4) {
                    $("blurBG").style.backdropFilter = "blur(10px)  hue-rotate(100deg)";
                }
                if (currIndex == 2 && index == 3 || index == 4) {
                    setTimeout(() => {
                        lastPos = window.scrollY / zoomLevel;
                        window.scrollTo(0, 0);
                        ShowFixedElements();
                    }, 50);
                }
                else {
                    setTimeout(() => {
                        window.scrollTo(0, lastPos * zoomLevel);
                        lastPos = 0;
                    }, 50);
                }
                setTimeout(() => {
                    ShowFixedElements();
                }, 400)
                currIndex = index;
                // else if (index == 3) {
                //     $("blurBG").style.backdropFilter = "blur(5px) grayscale(0.5) brightness(80%) contrast(1.1)"
                // }
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
    time += ("0" + (now.getMonth() + 1)).slice(-2);
    time += ("0" + now.getDate()).slice(-2);
    time += ("0" + now.getHours()).slice(-2);
    time += ("0" + now.getMinutes()).slice(-2);
    time += ("0" + now.getSeconds()).slice(-2);
    time += ("000" + now.getMilliseconds()).slice(-3);
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
    posInHist++;
    let hist = histories[posInHist];
    SwitchPage(hist.filename, hist.header, hist.index, true);
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
        alert("My Email Address: kafuuchino_15532@foxmail.com\n\nThe email address is copied to your clipboard.\
            If the default email software doesn't pop out, please enter this address manually in your email software.");
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
    let doc = parser.parseFromString(content, "text/html");
    let scripts = doc.getElementsByClassName("script");
    let scriptContent;
    Array.from(scripts).forEach(element => {
        scriptContent += element.innerHTML;
    });
    eval(scriptContent);
}

function ShowArtworkImage(name) {
    let elem = document.createElement("div");
    elem.style = "z-index: 1000; transition: all 100ms; position: fixed; top: 0px; height: 100%; width: 100%; background-color: rgba(0,0,0, 0.5); opacity: 0;";
    elem.innerHTML += "<image id='img' src='OtherWorks/" + name + ".jpg' style='position: absolute; margin:auto; top: 0px; bottom: 0px; left: 0px; right: 0px; max-height: 90%; max-width: 90%; object-fit: contain;\
    border-radius: 10px; border-style: solid; border-color: white;'/>";
    elem.onclick = () => {
        elem.style.opacity = 0;
        setTimeout(() => {
            document.body.removeChild(elem);
        }, 100);
    }
    document.body.appendChild(elem);
    setTimeout(() => {
        elem.style.opacity = 1;
    }, 50);
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
