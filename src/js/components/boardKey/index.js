import { h, Fragment } from "preact";

export default function BoardKey(props) {
	var race = props.race;
	var hasParties = race !== "ballot";
  var hasPickup = race == "house" || race == "senate";
	var hasIncumbent = race == "house" || race == "senate" || race == "gov";
	var hasEEVP = race !== "house";

  return <div class="board-key">
    <h3>Key</h3>
    <ul>
      {hasParties && <>
	      	<li class="dem">Democrat / <span class="leading">Leading</span> <span class="winner">Winner</span></li>
	      	<li class="gop">Republican / <span class="leading">Leading</span> <span class="winner">Winner</span></li>
	      	<li class="ind">Independent / <span class="leading">Leading</span> <span class="winner">Winner</span></li>
      </>}
      {hasParties && <li class="pickup"><span>FLIP</span> {hasPickup ? "Seat pickup" : "Change in winning party"} (party color)</li>}
      {hasParties && <li class="runoff"><span>R.O.</span> Going to a runoff election</li>}
      {!hasParties && <>
      	<li class="yes">Yes / <span class="leading">Leading</span> <span class="winner">Winner</span></li>
      	<li class="no">No / <span class="leading">Leading</span> <span class="winner">Winner</span></li>
      </>}
      <li class="eevp"><span class="perc">76% in</span> {hasEEVP ? <span>Estimated expected vote <span class="link">(<a href="https://www.ap.org/en-us/topics/politics/elections/counting-the-vote">what's this?</a>)</span></span> : "Precincts reporting"}</li>
      {hasIncumbent && <li class="incumbent">● Incumbent</li>}
    </ul>
  </div>
}