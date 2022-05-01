// ==UserScript==
// @name         SpriteClub Bot Script
// @version      1.0
// @description  A SpriteClub betting automation script
// @author       327y (https://github.com/327y)
// @match        https://mugen.spriteclub.tv/
// @require      https://code.jquery.com/jquery-3.5.1.min.js
// @run-at       document-idle
// ==/UserScript==

(() => {
    "use strict";

    // -- CONFIGURATION --
    let config = {
        /* Maximum number of log entries to be saved. Negative values are
           converted to positive values. Set to 0 to disable logging.
        */
        maxLogs: 30,

        /* Set how the bot should decide which side to bet on.
           Allowed values are:
           - "author": Bet when the desired author's character appears.
           - "random": Bet randomly.
           - "both":   Combines the above, with "author" taking precedence over "random", 
                       i.e. the bot bets via "random" if it doesn't bet via "author".
           If "author" or "both" is chosen, bettingAuthor needs to be specified as well.
           Any other value defaults to "random".
        */
        bettingMode: "random",
        /* The author for which the bot should bet, if bettingMode is set appropriately.
           If both sides feature the work of the same author, the side is chosen randomly.
        */
        bettingAuthor: "",
        /* If bettingAuthorExactMatch is set to true, the bot checks if the given author
           matches the author field. If set to false, the bot checks if the given author
           is included in the author field.
        */
        bettingAuthorExactMatch: false,

        /* Defines how the bot should bet.
           Allowed values are:
           - "f": Bets based on a fixed value
           - "p": Bets based on a percentage of the total balance
           Any other value defaults to "f".
        */
        bettingValueType: "f",
        /* Defines how much should be bet. The bot considers this either a fixed
           value or a percentage, depending on which value type is chosen above.
           For "f", the given value is directly used.
           For "p", the valid input range is 0-100.
           Any invalid value defaults to 0 to prevent you from losing your balance.
        */
        bettingValue: 1,

        /* If bettingMode is set to "author", the bot can notify via a Discord
           webhook if the specified author's character is about to fight.
           Set authorBetNotif to true and add a Discord webhook URL to be
           notified by the bot.
           Disabled by default and if no URL is specified.
        */
        authorBetNotif: false,
        webhookURL: ""

    }
    // -- END CONFIGURATION --

    function addStyle(cssString) {
        let head = document.getElementsByTagName("head")[0];
        if (head) {
            let style = document.createElement("style");
            style.setAttribute("type", "text/css");
            style.textContent = cssString;
            head.appendChild(style);
            return true;
        } else {
            return false;
        }
    }

    let $ = window.jQuery;
    let scState; // Keeps track of the site's state
    let middleBox = $("#middle");
    let logBox = $("#chatDiv");
    let betBox = $("#betDiv");
    let botObserver; // Observes site style changes to determine state
    let styleSuccessful = addStyle("#botDiv{position:absolute;left:10px;bottom:50px;}");

    function log(color = null, msg = null) {
        if (logBox.find("div.log").length >= config.maxLogs) logBox.find("div.log").first().remove();
        let output = "<div class=\"log " + ((color !== null) ? "log-" + color : "") + "\">";
        let timestamp = new Date();
        if (msg === null) {
            output += "<span>" + timestamp.toISOString() + " // Current mode: " + scState + " </span>";
            output += "<span style=\"display:inline-block\">[ " + $("#bluePlayer").html() + " vs " + $("#redPlayer").html() + " ]</span>"
        } else {
            output += "<span>" + timestamp.toISOString() + " // " + msg + "</span>";
        }
        output += "</div>";
        logBox.append(output);
    }

    function click(side = null) {
        /* The clicking method first bets with a value of zero to update the balance display
           in case the game mode switches from tournament to matchmaking and vice versa.
           This is due to an issue at the time of writing this script where the shown balance
           would only update to the game mode's balance after betting once.
        */
        if ((side === "blue" || side === "red") && side != null) {
            middleBox.find("#wager").val("0");
            middleBox.find(`#${side}Button`).click();
            let balance = parseInt($("#balance").html().substring(1).replaceAll(",", ""));
            setTimeout(function () {
                if (config.bettingValueType === "p" && (0 <= config.bettingValue <= 100)) {
                    middleBox.find("#wager").val(balance * (config.bettingValue / 100));
                } else if (config.bettingValueType === "f" && 0 <= config.bettingValue) {
                    middleBox.find("#wager").val(config.bettingValue);
                } else {
                    middleBox.find("#wager").val(0);
                }
                middleBox.find(`#${side}Button`).click();
            }, 3000);
        }
    }

    function startBot() {
        let lhs = betBox.find("#betScrollDiv"); // betScrollDiv contains the divs responsible for displaying stats/bets

        /* This function is called when a visual change in the left-hand side is detected
           (essentially when the site transitions from betting to the fight and vice versa).
        */
        const stateCheck = function (mutations) {
            let output = "";
            let changedElem = mutations[0].target; // Element where the visual change occurred

            /* The blueBets div (which shows the placed bets) is being observed for style
               changes. When its opacity equals zero, the bets are hidden by the site and
               stats are displayed.
            */
            if (changedElem.style.opacity === "0" && changedElem.style.opacity !== opacState) {
                scState = "stats";
                let blueName = betBox.find("#bluePlayer").html();
                let blueAuthor = betBox.find("#blueAuthor").html();
                let redName = betBox.find("#redPlayer").html();
                let redAuthor = betBox.find("#redAuthor").html();

                let bet = null;
                let blueMatch = false;
                let redMatch = false;

                if (config.bettingMode === "author" || config.bettingMode === "both") {
                    blueMatch = (config.bettingAuthorExactMatch) ? blueAuthor === config.bettingAuthor : blueAuthor.includes(config.bettingAuthor);
                    redMatch = (config.bettingAuthorExactMatch) ? redAuthor === config.bettingAuthor : redAuthor.includes(config.bettingAuthor);

                    if (blueMatch && redMatch) {
                        let coinflip = Date.now() % 2;
                        bet = (coinflip) ? "blue" : "red";
                    } else if (blueMatch != redMatch) {
                        bet = (blueMatch) ? "blue" : "red";
                    }
                }
                if (config.bettingMode !== "author") {
                    let coinflip = Date.now() % 2;

                    if (blueMatch == redMatch) {
                        bet = (coinflip) ? "blue" : "red";
                    }
                }

                log(bet);
                if (config.authorBetNotif && config.webhookURL !== "" && (blueMatch || redMatch)) {
                    let post = {
                        embeds: [
                        {
                            title: "The following match calls for attention:",
                            fields: [
                            { name: blueName, value: blueAuthor, inline: true }, { name: redName, value: redAuthor, inline: true }
                            ],
                            color: 0xFF0000 * blueMatch + 0x0000FF * redMatch
                        }
                        ]
                    };

                    $.ajax({
                        url: config.webhookURL,
                        method: 'POST',
                        data: JSON.stringify(post),
                        contentType: "application/json; charset=utf-8",
                        dataType: "json",
                        statusCode: {
                        400: function(data, xhr) {
                            console.log(data, xhr);
                        }
                        }
                    });
                }
                click(bet);
                opacState = changedElem.style.opacity;
            } else if (changedElem.style.opacity === "1" && changedElem.style.opacity !== opacState) { // Bets
                scState = "bets";
                opacState = changedElem.style.opacity;
                log();
            }
        }

        let opacState = lhs.children()[0].style.opacity; // Read opacity of blueBets div
        botObserver = new MutationObserver((mutations) => { setTimeout(stateCheck, 1500, mutations) }); // Delay the state check due to opacity fade
        botObserver.observe(lhs.children()[0], { attributes: true, attributeFilter: ["style"] }); // Observe blueBets div for changes to style value
    }

    function stopBot() {
        botObserver.disconnect();
    }


    if (styleSuccessful) {
        $("body").append("<div id=\"botDiv\"><button id=\"botButton\">Start bot</button></div>");

        $("#botButton").on("click", function () {
            if ($(this).html() === "Start bot") {
                $(this).html("Stop bot");
                logBox.html("");
                addStyle("#chatDiv{background:#111;color:#bbb;padding:1rem;font-size:0.9em;overflow:auto!important}.log{background:#333;margin-bottom:0.5rem}.log-blue{background:#0000a5}.log-red{background:#a50000}.log-mix{background:linear-gradient(90deg,rgba(165,0,0,1) 0%,rgba(0,0,165,1) 100%)}");
                startBot();
            } else {
                $(this).html("Start bot");
                stopBot();
            }
        });
    } else {
        console.log("SC bot script: could not add necessary style elements");
    }
})();