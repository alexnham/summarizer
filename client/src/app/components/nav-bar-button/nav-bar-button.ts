import { Component, input } from "@angular/core";

@Component({
  selector: "nav-bar-button",
  templateUrl: "./nav-bar-button.html",
  styleUrls: ["./nav-bar-button.css"]
})
export class NavBarButton {
  text = input<string>();
}