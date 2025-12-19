import { Routes } from '@angular/router';
import { LoginComponent } from './components/app-login/app-login';
import { AppDashboard } from './components/app-dashboard/app-dashboard';


export const routes: Routes = [
    {path : '', redirectTo: 'login', pathMatch: 'full'},
    {path: 'login', component: LoginComponent},
    {path: 'dashboard', component: AppDashboard},
];
