var reportExpanded = false;
var reportArea;

function expandReport() {
    if (reportExpanded) {
        reportExpanded = false;
        //reportArea.morph('.reportReportHidden');
        reportArea.className = 'reportReportHidden';
    } else {
        reportExpanded = true;
        //reportArea.morph('.reportReportShown');
        reportArea.className = 'reportReportShown';
    }        
}

function newXMLHTTP () {
    var xmlhttp = false;
    try {xmlhttp = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {try {xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {xmlhttp = false;}}
    if (!xmlhttp && typeof XMLHttpRequest != 'undefined') xmlhttp = new XMLHttpRequest ();

    return xmlhttp;
}

function postReport () {
    var xmlhttp = newXMLHTTP ();

    dataString = '?levelid=' + document.getElementById ('frm_levelid').value;
    dataString += '&reason=' + document.getElementById ('frm_reason').value;

    xmlhttp.open ('GET', HTML_TOP + 'ajax/report.php' + dataString, true);
    xmlhttp.onreadystatechange = function () {
        switch (xmlhttp.readyState) {
            case 1 : case 2 : case 3 :
                document.getElementById ('reportResult').innerHTML = '<div class="ajax-loader">&nbsp;</div>';

                break;
            case 4 :
                theResult = xmlhttp.responseText;
                if (theResult == 'success') {
                	document.getElementById ('reportContent').innerHTML = 'Thank you, your report has been sent and we will <br />review it and take action accordingly.';
                } else {
                    document.getElementById ('reportResult').innerHTML = theResult;
                }
                break;
        }
    }

    xmlhttp.send (null);
}
