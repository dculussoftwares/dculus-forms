import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from '@dculus/ui';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Welcome to Form Viewer</h1>
        <p className="text-muted-foreground text-lg">
          A dedicated application for viewing and interacting with forms.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Live Form Demo</CardTitle>
            <CardDescription>
              Try our interactive form
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Experience a fully functional form with validation and submission.
            </p>
            <Button asChild>
              <Link to="/f/demo">Try Demo Form</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Form Layouts</CardTitle>
            <CardDescription>
              See different form styles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Explore various form layouts and styling options.
            </p>
            <Button variant="outline" asChild>
              <Link to="/f/layout-demo">View Layouts</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Form URLs</CardTitle>
            <CardDescription>
              Test different scenarios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Test form loading, errors, and edge cases.
            </p>
            <div className="space-y-2">
              <Button variant="secondary" size="sm" asChild className="w-full">
                <Link to="/f/not-found">Not Found</Link>
              </Button>
              <Button variant="secondary" size="sm" asChild className="w-full">
                <Link to="/f/inactive">Inactive Form</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About Form Viewer</CardTitle>
          <CardDescription>
            Learn more about this application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              Form Viewer is a dedicated application for viewing and interacting with forms. 
              It provides a clean, focused interface for form display and interaction with full support 
              for validation, multi-page navigation, and custom layouts.
            </p>
            <p>
              Forms are accessed via short URLs (e.g., <code>/f/demo</code>) and support various 
              layout styles, field types, and interactive features. Try the demo links above to explore!
            </p>
            <div className="flex gap-2">
              <Button asChild>
                <Link to="/demo">View Demo</Link>
              </Button>
              <Button variant="outline">
                Learn More
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home; 