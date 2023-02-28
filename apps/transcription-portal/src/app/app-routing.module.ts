import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {MainComponent} from './main/main.component';
import {CompatibilityGuard} from './shared/compatibility.guard';
import {BrowserTestComponent} from './components/browser-test/browser-test.component';

const routes: Routes = [
  {path: '', component: MainComponent, canActivate: [CompatibilityGuard]},
  {path: 'test', component: BrowserTestComponent, canActivate: [CompatibilityGuard]},
  {path: '**', redirectTo: '/', pathMatch: 'full'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
