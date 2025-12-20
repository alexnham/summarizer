import { Component, input } from "@angular/core";
import { Router } from "@angular/router";

@Component({
  selector: "nav-bar-button",
  templateUrl: "./nav-bar-button.html",
  styleUrls: ["./nav-bar-button.css"]
})
export class NavBarButton {
  text = input<string>();
  id = input<string>();
  constructor(private router: Router) {}
  onClick() {
    this.router.navigate(["/summary", this.id()]);
    }
}