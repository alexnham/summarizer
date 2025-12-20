import { Component, input } from "@angular/core";
import { Router } from "@angular/router";
import { SummarizerService } from "../../services/summarizer.service";

@Component({
  selector: "nav-bar-button",
  templateUrl: "./nav-bar-button.html",
  styleUrls: ["./nav-bar-button.css"]
})
export class NavBarButton {
  text = input<string>();
  id = input<string>();

  constructor(
    private summaryService: SummarizerService,
    private router: Router
  ) {}

  onClick() {
    const id = this.id();
    if (!id) return;

    this.router.navigate(["/summary", id]);
  }

  async onDelete() {
    const id = this.id();
    const text = this.text();
    if (!id) return;

    const confirmed = confirm(
      `Are you sure you want to delete ${text}? This action cannot be undone.`
    );
    if (!confirmed) return;
    try {
    this.summaryService.deleteTranscription(id);
      alert("Summary deleted.");
      //reload
      location.reload();
      this.router.navigate(["/dashboard"]);
    } catch (err) {
      console.error("Error deleting summary:", err);
    }
  }
}