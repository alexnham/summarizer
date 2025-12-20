import { Component, input, signal } from "@angular/core";
import { SummarizerService } from "../../services/summarizer.service";
import { AuthService } from "../../services/auth.service";
import { Summary } from "../../models/summary.model";
import { ActivatedRoute } from '@angular/router';
import { SummaryNavBar } from "../summary-nav-bar/summary-nav-bar";

@Component({
    selector: "app-single-summary",
    templateUrl: "./single-summary.html",
    styleUrls: ["./single-summary.css"],
    imports: [SummaryNavBar]
})
export class SingleSummary {
    id: string = null as any;
    summary = signal<Summary | null>(null);
    content = signal<any[] | null>(null);
    constructor(private authService: AuthService, private summaryService: SummarizerService, private route: ActivatedRoute) { }

    async ngOnInit() {
        this.route.paramMap.subscribe(async (params) => {
            const id = params.get('id');
            if (!id) return;

            this.id = id;

            const response = await this.summaryService.getSummary(id);
            this.summary.set(response);
            this.content.set(JSON.parse(response.content));
        });
    }
}