function getObj(item)
{
	if (document.all) return(document.all[item]);
	if (document.getElementById) return(document.getElementById(item));
	return(false);
}

function get_xmlhttp_object()
{
    var xmlhttp = false;
    try {xmlhttp = new ActiveXObject ('Msxml2.XMLHTTP');} catch (e) {
        try {xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');} catch (E) {
            xmlhttp = false;
        }
    }

    if (!xmlhttp && typeof XMLHttpRequest != 'undefined') xmlhttp = new XMLHttpRequest ();

    return xmlhttp;
}

function get_page_content (url, theDiv)
{
    var xmlhttp = get_xmlhttp_object();

    var close_code = "<div style='text-align:right;font-size:10px;padding-top:2px;padding-bottom:5px;'><a href='javascript:closepopup();'><b>x close</b></a></div>";

    xmlhttp.open ('GET', url, true);
    xmlhttp.onreadystatechange = function () {
        switch (xmlhttp.readyState) {
            case 1 : case 2 : case 3 :
            getObj(theDiv).innerHTML = "<img src='/playsega/images/loading.gif' />";
            break;
            case 4 :
                var x = (get_window_dimention('w') / 2) - 200;
                var y = getScrollXY() + (get_window_dimention('h') / 2);
                getObj(theDiv).innerHTML = close_code + xmlhttp.responseText;
                getObj(theDiv).style.top = y+'px';
                getObj(theDiv).style.left = x+'px';
                //getObj(theDiv).style.top = '100px';
                //getObj(theDiv).style.left = '100px';
                getObj('popupbackground').style.display = "block";
                getObj('popupbackground').style.height = document.body.clientHeight + 'px';
                document.body.clientHeight
                getObj(theDiv).style.display = "block";
            break;
        }
    }

    xmlhttp.send (null);

    return;
}

function closepopup()
{
    getObj('popupcontainer').style.display = "none";
    getObj('popupbackground').style.display = "none";
}

function get_window_dimention( w_or_h )
{
  var myWidth = 0, myHeight = 0;
  if( typeof( window.innerWidth ) == 'number' )
  {
    //Non-IE
    myWidth = window.innerWidth;
    myHeight = window.innerHeight;
  } else if( document.documentElement && ( document.documentElement.clientWidth || document.documentElement.clientHeight ) ) {
    //IE 6+ in 'standards compliant mode'
    myWidth = document.documentElement.clientWidth;
    myHeight = document.documentElement.clientHeight;
  } else if( document.body && ( document.body.clientWidth || document.body.clientHeight ) ) {
    //IE 4 compatible
    myWidth = document.body.clientWidth;
    myHeight = document.body.clientHeight;
  }

  if( w_or_h == 'w' ) return myWidth;
    else return myHeight;

}



function getScrollXY() {
  var scrOfX = 0, scrOfY = 0;
  if( typeof( window.pageYOffset ) == 'number' ) {
    //Netscape compliant
    scrOfY = window.pageYOffset;
    scrOfX = window.pageXOffset;
  } else if( document.body && ( document.body.scrollLeft || document.body.scrollTop ) ) {
    //DOM compliant
    scrOfY = document.body.scrollTop;
    scrOfX = document.body.scrollLeft;
  } else if( document.documentElement && ( document.documentElement.scrollLeft || document.documentElement.scrollTop ) ) {
    //IE6 standards compliant mode
    scrOfY = document.documentElement.scrollTop;
    scrOfX = document.documentElement.scrollLeft;
  }
  //return [ scrOfX, scrOfY ];
  return scrOfY;
}