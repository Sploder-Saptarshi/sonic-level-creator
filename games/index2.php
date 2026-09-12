<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=7"></meta>
<meta name="copyright" content="Sega Europe"></meta>
<meta name="author" content="Sega Europe - Online Services"></meta>
<meta name="resource-type" content="document"></meta>
<meta name="revisit-after" content="3 days"></meta>
<meta name="distribution" content="global"></meta>
<meta name="rating" content="3+"></meta>
<meta name="description" content="PlaySEGA - THE OFFICIAL WEBSITE"></meta>
<meta name="keywords" content="sega, sega europe, sega japan, SOA, SOJ, sega america, sonic, sega games, sega support, games, video games, videogames, videoconsoles, console games, Xbox, games movies, downloads, screen shots, screens, screenshots, movies, wallpapers, news, cheats, hints, tips, support, SEGA, juego, juex,"></meta>
    <meta name="robots" content="index, follow" />
    <title>Guest | Level Creators | PlaySEGA</title>


<link rel="stylesheet" href="../css/playsega.css" type="text/css" media="screen" />
<link rel="stylesheet" href="../css/sIFR-screen.css" type="text/css" media="screen" />
<link rel="stylesheet" href="../css/sIFR-print.css" type="text/css" media="print" />

<script src="../js/shadedborder.js" type="text/javascript"></script>
<script src="../js/events.js" type="text/javascript"></script>
<script src="../js/sifr.js" type="text/javascript"></script>
<script src="../js/sifr-config.js" type="text/javascript"></script>
<script src="../js/swfobject.js" type="text/javascript"></script>
<script src="../js/mootools.js" type="text/javascript"></script>
<script src="../js/ajax.js" type="text/javascript"></script>
<script src="../js/pagination.js" type="text/javascript"></script>
<script src="../js/feedback.js" type="text/javascript"></script>
<script src="../js/tabs.js" type="text/javascript"></script>
<script src="../js/s_code.js" type="text/javascript"></script>


<script type="text/javascript">
//some path variables
var PLAYSEGA_PATH = "http://www.playsega.co.uk/";
var HTML_TOP = "/";
</script>

<!--
<script type="text/javascript" src="/fsrscripts/triggerParams.js"></script>
<script type="text/javascript" src="/fsrscripts/stdLauncher.js"></script>
-->

<script type="text/javascript">
//Ruzee borders
var border = RUZEE.ShadedBorder.create({ corner:10, border:3, shadow:22 });
var border2 = RUZEE.ShadedBorder.create({ corner:8, border:1 });
var splitBorderTop      = RUZEE.ShadedBorder.create({ corner:10, border:1, edges:"tlr" });
var splitBorderBottom   = RUZEE.ShadedBorder.create({ corner:10, border:1, edges:"blr" });
RUZEE.Events.add(window,'domload',function() {
    if (!window.$) {
      window.$ = function(id) { return document.getElementById(id); }
    }

    border.render('content1');

    /* Set up flags */
    var flagsSmallHeight = 16, flagsFullHeight = 47;

    var mainFlags = $$("#flags");
    var fx = new Fx.Elements (mainFlags, {wait: false, duration: 100});

     mainFlags.each (function (mainFlag, i) {
    	mainFlag.addEvent ("mouseenter", function (event) {
    		var o = {};

    		mainFlag.setStyle('background-image', 'url(http://' + document.domain + HTML_TOP + '/images/flag-top.gif)'); // Set Background Image for element
    		mainFlag.setStyle('background-position', 'top');                                                             // Set Background position for the element
    		mainFlag.setStyle('background-repeat', 'no-repeat');                                                         // State that we dont want the image to repeat

    		o[i] = { height: [mainFlag.getStyle ("height").toInt(), flagsFullHeight] }
    		fx.start(o);
    	});
    });
	mainFlags.each (function (mainFlag, i) {
        mainFlag.addEvent ("mouseleave", function (event) {
            mainFlag.setStyle('height', flagsSmallHeight);
            mainFlag.setStyle('background-image', 'none');
    	});
    })
    /* //Set up flags */

        //round all h3s
    splitBorderTop.render($('content1').getElementsByTagName('h3'));
    splitBorderTop.render($('content1').getElementsByTagName('h1'));splitBorderBottom.render('playGame');splitBorderTop.render($('content1').getElementsByTagName('h4'));reportArea = $('reportArea');reportButton = $('reporter');reportButton.addEvent('click', function(e) {
e.stop();
expandReport();
});getTicker ('tickerAll', 10, 3, '', '', 'true');

});

addTextToHeadings('http://www.playsega.co.uk/'); //adds text to the fancy headings
</script>
<script src="../js/slimbox/slimbox.js" type="text/javascript"></script>
<script src="../js/leaderboard.js" type="text/javascript"></script>
<script src="../js/achievements.js" type="text/javascript"></script>
<script src="../js/info.js" type="text/javascript"></script>
<script src="../js/PluginDetect.js" type="text/javascript"></script>
<script src="../js/ticker.js" type="text/javascript"></script>
<link rel="stylesheet" href="../css/slimbox.css" type="text/css" media="screen" /><script src="../js/report.js"
                          type="text/javascript"></script><script src="../js/notifications.js"
                          type="text/javascript"></script>
</head>
<body>
    <div id="popupcontainer" class="popupcontainer2"></div>
        <div id="popupbackground"></div>
            <div id="content1">
                <div id="logo">
                    <div id="logo2">
                                                    <p><a href="../"><img src="/images/PlaySEGA.gif" height="98" width="222" alt="PlaySEGA" /></a></p>
                                            </div>
                </div>

<div class="flags-float" style="z-index: 9000">
    <div class="flags-float-inner" style="z-index: 9000">
        <div id="flags" class="flags">
            <div class="flag_top">
                <div class="EnglishUK">
                    <a href="#" class="link"><img src="/images/spacer.gif" alt="" rel="nofollow" /></a>
                </div>
            </div>
                        <div class="footer">
                <div class="EnglishUSA">
                    <a href="?t=EnglishUSA" class="link" title="EnglishUSA" rel="nofollow">
                        <img src="/images/spacer.gif" alt="" />
                    </a>
                </div>
            </div>
        </div>
    </div>
    <div class="clear">&nbsp;</div>
</div>
<div id="languagebar" class="loggedin">  <a class="lozenge1" href="../member/?action=signUp" rel="nofollow"><span>Sign up!</span></a>
  </div>


<ul id="topnav_in" class="loggedin">
  <li class="one"><a href="../games/" class="on">Play Games</a></li>
  <li class="two"><a href="../escape/">My Escape</a></li>
  <li class="three"><a href="../prizedraws/">Win Cash</a></li>
  <li class="four"><a href="../vip/">My VIP</a></li>
  <li class="five"><a href="../member/?action=editMyAccount" rel="nofollow">My Account</a></li>
  <li class="six"><a href="../downloads/">Download Games</a></li>
  <li class="seven"><a href="http://forums.sega.com/forumdisplay.php?f=115" target="_blank">Forum</a></li>
</ul>
    <div id="sidenav">
            <div id="sidenav1">
        <ul>
          <li class="arcade"><a href="../games/?action=listByGenre&amp;gt=1">Arcade Games</a></li>
          <li class="card"><a href="../games/?action=listByGenre&amp;gt=2">Card Games</a></li>
                    <li class="editors"><a href="../editors">Level Editors</a></li>
          <li class="megadrive"><a href="../games/?action=listByGenre&amp;gt=0&amp;type=2">Mega Drive Games</a></li>          <li class="puzzle"><a href="../games/?action=listByGenre&amp;gt=3">Puzzle Games</a></li>
          <li class="quiz"><a href="../games/?action=listByGenre&amp;gt=4">Quiz Games</a></li>
          <li class="sonic"><a href="../games/?action=listByGenre&amp;gt=5">Sonic Games</a></li>
          <li class="sports"><a href="../games/?action=listByGenre&amp;gt=6">Sports Games</a></li>
          <li class="word"><a href="../games/?action=listByGenre&amp;gt=7">Word Games</a></li>
        </ul>
      </div>

              <div id="sidenav3">
            <a href="../info/?action=quickStartGuide" class="quickstart"></a>
            <a href="../games/?action=listAll" class="allgames"></a>
        </div>
          <div id="upsellOne" class="upsellOne">
    <div class="upsell_guest">
        <div class="upsellOneContent">
            <div class="upsellOnePerks">
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Scores">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Save high scores</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Rings2">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Collect PlaySEGA rings</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Prizes2">&nbsp;</div>
                    <div class="upsellOnePerk_Text">Win cash prizes</div>
                </div>
                <div class="upsellOnePerk">
                    <div class="upsellOnePerk_Trial">&nbsp;</div>
                    <div class="upsellOnePerk_Text">
                        FREE 5 day PlaySEGA<sup>VIP</sup> trial
                    </div>
                </div>
            </div>
            <div class="upsellButton">
                <a class="sifrButton1" href="../member/?action=signUp"><span class="text"><span class="fancybutton">Sign up now</span></span></a>
            </div>
        </div>
    </div>
</div>

<div class="clear">&nbsp;</div>
    </div>    <div id="pagecontent">
    
<div class="ad_lb">
    <!-- begin ad tag-->
            <script type="text/javascript">
        <!--
        if (typeof ord=='undefined') {ord=Math.random()*10000000000000000;}
        document.write('<iframe id="leaderboard_ad" src="http://ad.doubleclick.net/adi/ober.playsegauk/games;sz=728x90;ord=' + ord + '?" width="728" height="90" marginwidth="0" marginheight="0" frameborder="0" scrolling="no">');
        if (navigator.userAgent.indexOf("Gecko")==-1)
        {document.write('<script language="JavaScript" src="http://ad.doubleclick.net/adj/ober.playsegauk/games;sz=728x90;abr=!ie;ord=' + ord + '?" type="text/javascript"><\/script>');
        }
        document.write('</iframe>');
        -->
        </script><noscript><a href="http://ad.doubleclick.net/jump/ober.playsegauk/games;sz=728x90;ord=123456789?" target="_blank"><img src="http://ad.doubleclick.net/ad/ober.playsegauk/games;sz=728x90;ord=123456789?" width="728" height="90" border="0" alt=""></a></noscript>
            <!-- End ad tag -->

<script type="text/javascript"><!--
// set relaod interval in milliseconds
var reloadInterval = 30000;

// this reloads the iframe, and triggers the next reload interval
function reload() {
	//call the function on the applet that decides whether we need to grab focus back
	var applets_ar = document.getElementsByTagName("applet");	
	if(applets_ar.length>0) {
		applets_ar[0].emuMarkFocus();
	}
    var iframe = document.getElementById('leaderboard_ad');

    if (!iframe) {return false};

    iframe.src = iframe.src.substring(0, iframe.src.indexOf('ord='))+'ord='+(Math.random()*10000000000000000)+'?';

    setTimeout('reload()',reloadInterval);
    //call the function on the applet that grabs focus back if required
	if(applets_ar.length>0) {
		applets_ar[0].emuRequestFocus();
	}
}
/*
function reload() {

  var iframe = document.getElementById('leaderboard_ad');

  if (!iframe) {return false};

  iframe.src = iframe.src.substring(0, iframe.src.indexOf('ord='))+'ord='+(Math.random()*10000000000000000)+'?';

  setTimeout('reload()',reloadInterval);
  document.getElementsByTagName( "applet" )[0].emuRequestFocus();   
} 
*/
 
//reload the advert after the interval has elapsed
setTimeout('reload()',reloadInterval);
--></script>

</div>

<!-- play game section -->
<div id="box3" style="margin-bottom:10px; z-index: 1000">
  <h3><span class="fancy">Sonic The Hedgehog Level Player - Fantasy Zone</span></h3>
  <div class="content" id="playGame" style="padding:0">
            <script type="text/javascript">
            var gcat=8;
            var gsku=52;
        </script>        <div id="gamecontainer" style="height:448px">
            <div id="gameswf">
            <div id="preroll_mpu">
    <script type="text/javascript">
    if (typeof ord=='undefined') {ord=Math.random()*10000000000000000;}
    <!-- begin ad tag-->
            document.write('<'+'script src="http://ad.doubleclick.net/adj/ober.playsegauk/games;sz=300x250;ord=' + ord + '?" type="text/javascript"><\/script>');
            </script>
    <script type="text/javascript">
    document.write('<p><img src="../images/game-loading.gif" height="30" width="160" alt="Your game is loading..." /></p>')
    </script>
</div>                <noscript>
                  <div id="js">&nbsp;</div>
                </noscript>
                <div id="fl">&nbsp;</div>
                <div id="java"><a href="http://www.java.com/" target="_blank">Click here to download</a></div>          </div>
        </div>

        <div class="clear">&nbsp;</div>

<center><div class="border5" id="upsellTwo" style="width: 700px; margin: 10px 0 0 0; float: none">
    <div style="height: 40px">
        <div style="float: left; width: 50px; padding: 2px 0 0 0"><img src="../images/info-warning.gif" /></div>
        <div style="text-align: left; float: left; width: 450px; padding: 12px 0 0 0">
            You are currently a Guest. Get access to all our games with PlaySEGA VIP.
        </div>
        <div style="float: right; width: 180px; padding: 10px 0 0 0"><a class="lozenge2" href="../member/?action=signUp"><span>START FREE TRIAL</span></a></div>
    </div>
</div></center>

<script type="text/javascript">border2.render('upsellTwo');</script>
            
            <!-- Report & AddThis Button BEGIN -->
            <div class="clear">&nbsp;</div>

            <center><div style="width: 720px; z-index: 1000">                <div class="report">
                    <div class="reportButton">
                        <a class="lozenge1" id="reporter" href="javascript:void(0)"><span>Report Level</span></a>
                        <a class="lozenge2" href="javascript:void(0);"
                           onclick="javascript:notifyOfLeaving('/editors/?action=edit&gamegroupid=52', false);">
                            <span>Create Level</span>
                        </a>
                        <a class="lozenge2" href="javascript:void(0);"
                           onclick="javascript:notifyOfLeaving('/editors/?action=myLevels&gamegroupid=52', false);">
                            <span>My Levels</span>
                        </a>
                        <a class="lozenge2" href="javascript:void(0);"
                           onclick="javascript:notifyOfLeaving('/editors/?action=editorDetail&gamegroupid=52', false);">
                            <span>All Levels</span>
                        </a>
                    </div>
                    <div class="reportReportHidden" id="reportArea">
                        <div class="reportHeading">
                            <div class="headingText">Report This Level</div>
                            <div class="closeButton" onclick="expandReport()">&nbsp;</div>
                        </div>
                        <div class="reportContent" id="reportContent">                            Why is this level inappropriate?
                            <div class="clear">&nbsp;</div>
                            <input type="hidden" id="frm_levelid" value="2871" />
                            <textarea id="frm_reason" class="reportTextArea"></textarea>
                            <div class="clear">&nbsp;</div>
                            <div id="reportResult" class="reportResult">&nbsp;</div>
                            <a class="lozenge1" href="javascript:void(0)" onclick="javascript:postReport()"><span>Submit</span></a>                        </div>
                    </div>
                </div>


                        
                <div style="float: right; text-align: right; margin: 8px 0 10px 0; width: 100px">
                    <script type="text/javascript">var addthis_pub="playsega";</script>
                    <a href="http://www.addthis.com/bookmark.php?v=20" onmouseover="return addthis_open(this, '', '[URL]', '[TITLE]')" onmouseout="addthis_close()" onclick="return addthis_sendto()"><img src="http://s7.addthis.com/static/btn/sm-share-en.gif" width="83" height="16" alt="Bookmark and Share" style="border:0"/></a><script type="text/javascript" src="http://s7.addthis.com/js/200/addthis_widget.js"></script>
                </div>
            </div></center>
            <div class="clear">&nbsp;</div>
            
                        
            
            
            <!-- Report & AddThis Button END -->
                    <div style="text-align:center;">
                
                                
                    <img src="../images/ratings/PEGI/large/3+.jpg" style="float:center;padding:5px;" alt="PEGI: 3+" title="PEGI: 3+"/>
                
                                
            </div>
            <div class="clear">&nbsp;</div>      
        
            		   

  </div>
</div>
<!-- //play game section -->

<div style="float: left; width: 420px">
</div>
<div style="margin: 0 0 0 10px; float: left">

  <div class="clear">&nbsp;</div>  
</div>


        <script type="text/javascript">
            function show_game()
            {
                if(swfobject.hasFlashPlayerVersion("6.0.65")) {//they have flash

                    var flashvars = {
                    id: "9f3210793951251c83ea5addaa24b963",territory: "EnglishUK",enableSkip: 1,levelid: 2871,contentSWF: "/games/swf/52/52.swf"                    };
                    var params = {
                        menu: "false"
                    };

                    swfobject.embedSWF("/swf/preloader/as3/v2/preloader-guest.swf",
                                       "gameswf",
                                       "640",
                                       "448",
                                       "9.0.0",
                                       "../swf/expressInstall.swf",
                                       flashvars,
                                       params);

                } else {//they dont have flash
                    swfobject.createCSS("#gameswf div#fl", "display:block;");
                    swfobject.createCSS("#gameswf div#preroll_mpu", "display:none;");
                }
            }
        </script><script type="text/javascript">
    //display the game after preroll
    setTimeout("show_game()", 12000);
    </script>
<div class="clear">&nbsp;</div>
</div>
<div style="clear:both"></div>
</div>
<div id="footer">
    

    		   <p><i>A very small percentage of people may experience seizures or blackouts triggered by flashing lights, patterns or certain visual images that may appear in video games.  Please be aware that even people who have never had a photosensitive epileptic seizure may have an undiagnosed condition that may be triggered by viewing video games.  In the event that you encounter any of the following symptoms: convulsions; eye or face twitching; loss of awareness; jerking and shaking of arms and legs; disorientation; altered vision, stop playing immediately and consult a doctor.  Parents should be aware of these symptoms as children and teenagers are more likely than adults to experience these seizures.  In order to reduce the risk of epileptic seizures it is advised that video games should be played in a well-lit room; not to play while drowsy or fatigued; take 10-15 minute breaks every hour.</i></p>

	    <p>&copy; SEGA 2009. SEGA and the SEGA logo are either registered trade marks or trade marks of SEGA Corporation.</p>
    <p>This website is optimised for FireFox 3+ and Internet Explorer 7+, requires cookies and JavaScript to be enabled, and requires <a target="_blank" href="http://get.adobe.com/flashplayer/" rel="nofollow">Adobe Flash Player</a></p>
    <p>
        <a href="../">Free Online Games</a> | <a href="../games/?action=listByGenre&amp;gt=1">Arcade Games</a> | <a href="../games/?action=listByGenre&amp;gt=2">Card Games</a> | <a href="../games/?action=listByGenre&amp;gt=3">Puzzle Games</a> | <a href="../games/?action=listByGenre&amp;gt=4">Quiz Games</a> | <a href="../games/?action=listByGenre&amp;gt=5">Sonic Games</a> | <a href="../games/?action=listByGenre&amp;gt=6">Sports Games</a> | <a href="../games/?action=listByGenre&amp;gt=7">Word Games</a> | <a href="../editors">Level Creators</a>    </p>
    <p>
        <a href="javascript:void(0)" onclick="javascript:showFeedback ('/games/index.php', '0')">Report an Error</a>
        |
        <a href="../info/?action=siteTerms" rel="nofollow">Site Terms &amp; Conditions</a>
        |
        <a href="../info/?action=prizeDrawTerms" rel="nofollow">Prize Draw Terms &amp; Conditions</a>
        |
        <a href="../info/?action=sitePrivacyPolicy" rel="nofollow">Privacy Policy</a>
        |
        <a href="http://help.sega.com/index.php?_m=knowledgebase&_a=view&parentcategoryid=137&pcid=0&nav=0&t=EnglishUK&group=default" rel="nofollow" target="_blank">Site Help & FAQs</a>
    </p>
</div>
<!-- Empty DIV for feedback box    // -->
<div id="feedback" class="feedbackContainer"></div>
<script type="text/javascript">moveIt (document.getElementById ('feedback'), findHeight (document.getElementById ('content1')), 360);</script>
<!-- SiteCatalyst code version: H.15.1.
        Copyright 1997-2008 Omniture, Inc. More info available at
        http://www.omniture.com -->
<script type="text/javascript"><!--
    /* You may give each page an identifying name, server, and channel on
        the next lines. */
    s.pageName="PlaySEGA::GAMES::play"
    s.server=""
    s.channel=""
    s.pageType=""
    s.prop1=""
    s.prop2=""
    s.prop3=""
    s.prop4=""
    s.prop7="Guest"
    s.prop15="GB"
    s.prop20=""
    s.prop21=""
    s.prop22=""
    /* Conversion Variables */
    s.campaign=""
    s.state=""
    s.zip=""
    s.events=""
    s.products=""
    s.purchaseID=""
    s.transactionID=""
    s.eVar1=""
    s.eVar2=""
    s.eVar3=""
    s.eVar4=""
    s.eVar5=""
    /* Hierarchy Variables */
    s.hier1=""
    /************* DO NOT ALTER ANYTHING BELOW THIS LINE ! **************/
    var s_code=s.t();if(s_code)document.write(s_code)//--></script>
<script type="text/javascript"><!--
    if(navigator.appVersion.indexOf('MSIE')>=0)document.write(unescape('%3C')+'\!-'+'-')
    //--></script><noscript><div><a href="http://www.omniture.com" title="Web Analytics"><img
                src="http://segaglobal.112.2O7.net/b/ss/segaglobal/1/H.16--NS/0"
                height="1" width="1" alt="" /></a></div></noscript><!--/DO NOT REMOVE/-->
<!-- End SiteCatalyst code version: H.16. -->


</body>
</html>