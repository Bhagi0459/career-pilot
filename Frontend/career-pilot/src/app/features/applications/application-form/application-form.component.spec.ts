import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ApplicationFormComponent } from './application-form.component';
import { environment } from '../../../../environments/environment';
import { Company, Recruiter } from '../../../shared/models';

const COMPANIES: Company[] = [
  { id: 1, name: 'Acme Corp', country: null, website: null, notes: null },
  { id: 2, name: 'Globex', country: null, website: null, notes: null }
];

const RECRUITERS: Recruiter[] = [
  { id: 10, name: 'Alice', email: null, linkedInUrl: null, companyId: 1, companyName: 'Acme Corp' },
  { id: 11, name: 'Bob', email: null, linkedInUrl: null, companyId: 2, companyName: 'Globex' }
];

function selectOptionByValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('ApplicationFormComponent (Add mode)', () => {
  let fixture: ComponentFixture<ApplicationFormComponent>;
  let component: ApplicationFormComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ApplicationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/companies`).flush(COMPANIES);
    httpMock.expectOne(`${environment.apiUrl}/recruiters`).flush(RECRUITERS);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('starts with an invalid, untouched companyId control', () => {
    expect(component.form.controls.companyId.value).toBe(0);
    expect(component.form.controls.companyId.invalid).toBeTrue();
  });

  it('selecting a company through the native <select> stores a numeric id and becomes valid', () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#companyId');
    // options[0] is the disabled placeholder; options[1] is the first real company (Acme, id 1)
    selectOptionByValue(select, select.options[1].value);
    fixture.detectChanges();

    expect(component.form.controls.companyId.value).toBe(1);
    expect(typeof component.form.controls.companyId.value).toBe('number');
    expect(component.form.controls.companyId.valid).toBeTrue();
  });

  it('filters the recruiter dropdown to recruiters belonging to the selected company', () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#companyId');
    selectOptionByValue(select, select.options[1].value); // Acme, id 1
    fixture.detectChanges();

    expect(component.filteredRecruiters().map((r) => r.id)).toEqual([10]);
  });

  it('resets recruiterId when switching to a company the selected recruiter does not belong to', () => {
    const companySelect: HTMLSelectElement = fixture.nativeElement.querySelector('#companyId');
    selectOptionByValue(companySelect, companySelect.options[1].value); // Acme, id 1
    fixture.detectChanges();

    component.form.controls.recruiterId.setValue(10); // Alice, belongs to Acme

    selectOptionByValue(companySelect, companySelect.options[2].value); // Globex, id 2
    fixture.detectChanges();

    expect(component.form.controls.recruiterId.value).toBe(0);
  });

  it('keeps recruiterId when the recruiter still belongs to the (re-)selected company', () => {
    const companySelect: HTMLSelectElement = fixture.nativeElement.querySelector('#companyId');
    selectOptionByValue(companySelect, companySelect.options[1].value); // Acme, id 1
    fixture.detectChanges();

    component.form.controls.recruiterId.setValue(10); // Alice, belongs to Acme

    selectOptionByValue(companySelect, companySelect.options[1].value); // still Acme
    fixture.detectChanges();

    expect(component.form.controls.recruiterId.value).toBe(10);
  });
});

describe('ApplicationFormComponent (Edit mode)', () => {
  let fixture: ComponentFixture<ApplicationFormComponent>;
  let component: ApplicationFormComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApplicationFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '42' }) } } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ApplicationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/companies`).flush(COMPANIES);
    httpMock.expectOne(`${environment.apiUrl}/recruiters`).flush(RECRUITERS);
    httpMock.expectOne(`${environment.apiUrl}/applications/42`).flush({
      id: 42,
      roleTitle: 'Senior Engineer',
      status: 'Applied',
      country: 'Germany',
      appliedDate: '2026-06-01T00:00:00Z',
      notes: null,
      companyId: 2,
      companyName: 'Globex',
      recruiterId: 11,
      recruiterName: 'Bob'
    });
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('patches companyId and recruiterId as numbers from the loaded application', () => {
    expect(component.form.controls.companyId.value).toBe(2);
    expect(component.form.controls.recruiterId.value).toBe(11);
    expect(component.form.controls.companyId.valid).toBeTrue();
  });

  it('shows the saved recruiter as an option in the filtered recruiter dropdown', () => {
    expect(component.filteredRecruiters().map((r) => r.id)).toContain(11);
  });
});
