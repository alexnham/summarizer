import { Routes } from '@angular/router';
import { LoginComponent } from './components/app-login/app-login';
import { AppDashboard } from './components/app-dashboard/app-dashboard';
import { SingleSummary } from './components/single-summary/single-summary';


export const routes: Routes = [
    {path : '', redirectTo: 'login', pathMatch: 'full'},
    {path: 'login', component: LoginComponent},
    {path: 'dashboard', component: AppDashboard},
    {path: 'summary/:id', component: SingleSummary},
];
